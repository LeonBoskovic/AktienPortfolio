from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.security import HTTPBearer
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import yfinance as yf
import pandas as pd
from passlib.context import CryptContext
from jose import JWTError, jwt
import requests
from pymongo import MongoClient

ROOT_DIR = Path(__file__).parent
if os.getenv("RENDER") is None:
    load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Sync client for some operations
sync_client = MongoClient(mongo_url)
sync_db = sync_client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Auth Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    name: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionData(BaseModel):
    user_id: str
    session_token: str
    user: User

# Portfolio Models
class TradeCreate(BaseModel):
    symbol: str
    quantity: float
    price: float
    trade_type: str = Field(..., description="buy or sell")
    trade_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Trade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    symbol: str
    quantity: float
    price: float
    trade_type: str
    trade_date: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Portfolio(BaseModel):
    symbol: str
    total_quantity: float
    avg_price: float
    current_price: float = 0.0
    market_value: float = 0.0
    pnl: float = 0.0
    pnl_percentage: float = 0.0
    
class WatchlistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    symbol: str
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StockPrice(BaseModel):
    symbol: str
    current_price: float
    change: float
    change_percent: float
    volume: int
    last_updated: datetime

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and 'T' in value and (value.endswith('Z') or '+' in value):
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    pass
    return item

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    password = password[:72]
    return pwd_context.hash(password)

def create_session_token():
    return str(uuid.uuid4())

# Auth dependencies
async def get_current_user(request: Request, credentials: Optional[dict] = Depends(security)) -> Optional[User]:
    """Get current user from session token (cookie or Authorization header)"""
    token = None
    
    # Check cookie first
    if 'session_token' in request.cookies:
        token = request.cookies['session_token']
    # Fallback to Authorization header
    elif credentials and credentials.credentials:
        token = credentials.credentials
    
    if not token:
        return None
    
    # Find session in database
    session = await db.user_sessions.find_one({
        "session_token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        return None
    
    # Get user
    user_doc = await db.users.find_one({"id": session["user_id"]})
    if not user_doc:
        return None
    
    return User(**parse_from_mongo(user_doc))

async def require_auth(user: User = Depends(get_current_user)) -> User:
    """Require authentication"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user

# Stock data functions
def get_stock_data(symbols: List[str]) -> Dict[str, Any]:
    """Fetch current stock data from Yahoo Finance"""
    if not symbols:
        return {}
    
    try:
        data = {}
        
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                hist = ticker.history(period="1d")
                
                if not hist.empty:
                    current_price = float(hist['Close'].iloc[-1])
                    prev_close = float(info.get('previousClose', current_price))
                    change = current_price - prev_close
                    change_percent = (change / prev_close) * 100 if prev_close != 0 else 0
                    
                    data[symbol] = {
                        'symbol': symbol,
                        'current_price': current_price,
                        'change': change,
                        'change_percent': change_percent,
                        'volume': int(hist['Volume'].iloc[-1]) if not hist['Volume'].empty else 0,
                        'last_updated': datetime.now(timezone.utc)
                    }
            except Exception as e:
                logging.error(f"Error fetching data for {symbol}: {e}")
                data[symbol] = None
        
        return data
    except Exception as e:
        logging.error(f"Error fetching stock data: {e}")
        return {}

# Register-Route
@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Passwort auf 72 Zeichen kürzen
    truncated_password = user_data.password[:72]
    
    # Gehashtes Passwort erzeugen
    hashed_password = get_password_hash(truncated_password)

    # User erstellen
    user = User(
        email=user_data.email,
        name=user_data.name
    )
    
    # Save to database
    user_dict = prepare_for_mongo(user.dict())
    user_dict['hashed_password'] = hashed_password
    await db.users.insert_one(user_dict)
    
    return {"message": "User registered successfully", "user_id": user.id}



@api_router.post("/auth/login")
async def login(user_data: UserLogin, response: Response):
    # Find user
    user_doc = await db.users.find_one({"email": user_data.email})
    if not user_doc or not verify_password(user_data.password, user_doc.get('hashed_password', '')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Create session
    session_token = create_session_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session = UserSession(
        user_id=user_doc['id'],
        session_token=session_token,
        expires_at=expires_at
    )
    
    # Save session
    await db.user_sessions.insert_one(prepare_for_mongo(session.dict()))
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        max_age=7*24*60*60,  # 7 days
        httponly=True,
        secure=True,
        samesite="none"
    )
    
    user = User(**parse_from_mongo(user_doc))
    return {"user": user, "session_token": session_token}

@api_router.post("/auth/google")
async def google_auth(request: Request, response: Response):
    """Handle Emergent Google OAuth callback"""
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    # Call Emergent auth service
    try:
        auth_response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
            timeout=10
        )
        auth_response.raise_for_status()
        auth_data = auth_response.json()
    except requests.RequestException as e:
        logging.error(f"Emergent auth error: {e}")
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # Check if user exists
    user_doc = await db.users.find_one({"email": auth_data["email"]})
    
    if not user_doc:
        # Create new user
        user = User(
            email=auth_data["email"],
            name=auth_data["name"],
            picture=auth_data.get("picture")
        )
        user_dict = prepare_for_mongo(user.dict())
        await db.users.insert_one(user_dict)
        user_id = user.id
    else:
        user_id = user_doc["id"]
        user = User(**parse_from_mongo(user_doc))
    
    # Create session with Emergent session token
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session = UserSession(
        user_id=user_id,
        session_token=auth_data["session_token"],
        expires_at=expires_at
    )
    
    # Save session
    await db.user_sessions.insert_one(prepare_for_mongo(session.dict()))
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=auth_data["session_token"],
        max_age=7*24*60*60,
        httponly=True,
        secure=True,
        samesite="none"
    )
    
    return {"user": user, "session_token": auth_data["session_token"]}

@api_router.get("/auth/me")
async def get_current_user_info(user: User = Depends(require_auth)):
    return user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response, user: User = Depends(require_auth)):
    # Get token
    token = request.cookies.get('session_token')
    if token:
        # Delete session from database
        await db.user_sessions.delete_one({"session_token": token})
    
    # Clear cookie
    response.delete_cookie("session_token", path="/", secure=True, samesite="none")
    
    return {"message": "Logged out successfully"}

# Portfolio Routes (Protected)
@api_router.get("/")
async def root():
    return {"message": "Portfolio Tracker API"}

# Stock prices (Public)
@api_router.get("/stocks/{symbol}")
async def get_stock_price(symbol: str):
    data = get_stock_data([symbol.upper()])
    if symbol.upper() in data and data[symbol.upper()]:
        return data[symbol.upper()]
    raise HTTPException(status_code=404, detail="Stock not found")

@api_router.post("/stocks/batch")
async def get_multiple_stocks(symbols: List[str]):
    data = get_stock_data([s.upper() for s in symbols])
    return data

# Trades (Protected)
@api_router.post("/trades", response_model=Trade)
async def create_trade(trade: TradeCreate, user: User = Depends(require_auth)):
    trade_dict = trade.dict()
    trade_dict['symbol'] = trade_dict['symbol'].upper()
    trade_dict['user_id'] = user.id
    trade_obj = Trade(**trade_dict)
    
    # Prepare for MongoDB
    mongo_data = prepare_for_mongo(trade_obj.dict())
    await db.trades.insert_one(mongo_data)
    
    return trade_obj

@api_router.get("/trades", response_model=List[Trade])
async def get_trades(user: User = Depends(require_auth)):
    trades = await db.trades.find({"user_id": user.id}).sort("trade_date", -1).to_list(1000)
    return [Trade(**parse_from_mongo(trade)) for trade in trades]

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str, user: User = Depends(require_auth)):
    result = await db.trades.delete_one({"id": trade_id, "user_id": user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"message": "Trade deleted"}

# Portfolio (Protected)
@api_router.get("/portfolio")
async def get_portfolio(user: User = Depends(require_auth)):
    trades = await db.trades.find({"user_id": user.id}).to_list(1000)
    
    # Calculate positions
    positions = {}
    for trade_data in trades:
        trade = parse_from_mongo(trade_data)
        symbol = trade['symbol']
        quantity = trade['quantity']
        price = trade['price']
        trade_type = trade['trade_type']
        
        if symbol not in positions:
            positions[symbol] = {'total_quantity': 0, 'total_cost': 0}
        
        if trade_type.lower() == 'buy':
            positions[symbol]['total_quantity'] += quantity
            positions[symbol]['total_cost'] += quantity * price
        elif trade_type.lower() == 'sell':
            positions[symbol]['total_quantity'] -= quantity
            positions[symbol]['total_cost'] -= quantity * price
    
    # Filter out closed positions and get current prices
    active_positions = {k: v for k, v in positions.items() if v['total_quantity'] > 0}
    
    if not active_positions:
        return []
    
    symbols = list(active_positions.keys())
    stock_data = get_stock_data(symbols)
    
    portfolio = []
    for symbol, position in active_positions.items():
        current_data = stock_data.get(symbol)
        if current_data:
            avg_price = position['total_cost'] / position['total_quantity'] if position['total_quantity'] != 0 else 0
            current_price = current_data['current_price']
            market_value = position['total_quantity'] * current_price
            cost_basis = position['total_cost']
            pnl = market_value - cost_basis
            pnl_percentage = (pnl / cost_basis) * 100 if cost_basis != 0 else 0
            
            portfolio.append(Portfolio(
                symbol=symbol,
                total_quantity=position['total_quantity'],
                avg_price=avg_price,
                current_price=current_price,
                market_value=market_value,
                pnl=pnl,
                pnl_percentage=pnl_percentage
            ))
    
    return portfolio

@api_router.delete("/portfolio/{symbol}")
async def close_position(symbol: str, user: User = Depends(require_auth)):
    """Close/remove a position from portfolio"""
    # Delete all trades for this symbol and user
    result = await db.trades.delete_many({
        "symbol": symbol.upper(),
        "user_id": user.id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Position not found")
    
    return {"message": f"Position {symbol.upper()} closed successfully", "trades_deleted": result.deleted_count}

# Portfolio summary (Protected)
@api_router.get("/portfolio/summary")
async def get_portfolio_summary(user: User = Depends(require_auth)):
    portfolio = await get_portfolio(user)
    
    if not portfolio:
        return {
            "total_value": 0,
            "total_cost": 0,
            "total_pnl": 0,
            "total_pnl_percentage": 0,
            "positions_count": 0
        }
    
    total_value = sum(p.market_value for p in portfolio)
    total_cost = sum(p.total_quantity * p.avg_price for p in portfolio)
    total_pnl = total_value - total_cost
    total_pnl_percentage = (total_pnl / total_cost) * 100 if total_cost != 0 else 0
    
    return {
        "total_value": total_value,
        "total_cost": total_cost,
        "total_pnl": total_pnl,
        "total_pnl_percentage": total_pnl_percentage,
        "positions_count": len(portfolio)
    }

# Watchlist (Protected)
@api_router.post("/watchlist", response_model=WatchlistItem)
async def add_to_watchlist(symbol: str, user: User = Depends(require_auth)):
    # Check if already in watchlist
    existing = await db.watchlist.find_one({
        "symbol": symbol.upper(),
        "user_id": user.id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")
    
    item = WatchlistItem(symbol=symbol.upper(), user_id=user.id)
    mongo_data = prepare_for_mongo(item.dict())
    await db.watchlist.insert_one(mongo_data)
    
    return item

@api_router.get("/watchlist")
async def get_watchlist(user: User = Depends(require_auth)):
    watchlist = await db.watchlist.find({"user_id": user.id}).sort("added_at", -1).to_list(100)
    symbols = [item['symbol'] for item in watchlist]
    
    if symbols:
        stock_data = get_stock_data(symbols)
        result = []
        for item in watchlist:
            symbol = item['symbol']
            price_data = stock_data.get(symbol)
            result.append({
                "id": item['id'],
                "symbol": symbol,
                "added_at": item['added_at'],
                "current_price": price_data['current_price'] if price_data else None,
                "change": price_data['change'] if price_data else None,
                "change_percent": price_data['change_percent'] if price_data else None
            })
        return result
    
    return []

@api_router.delete("/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str, user: User = Depends(require_auth)):
    result = await db.watchlist.delete_one({
        "symbol": symbol.upper(),
        "user_id": user.id
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Symbol not found in watchlist")
    return {"message": "Removed from watchlist"}

# Market overview (Public)
@api_router.get("/market/overview")
async def get_market_overview():
    # Get popular stocks
    popular_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "NFLX"]
    data = get_stock_data(popular_symbols)
    
    return {symbol: info for symbol, info in data.items() if info is not None}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
