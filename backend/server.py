from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import yfinance as yf
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class TradeCreate(BaseModel):
    symbol: str
    quantity: float
    price: float
    trade_type: str = Field(..., description="buy or sell")
    trade_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Trade(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
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
            if isinstance(value, str) and 'T' in value and value.endswith('Z'):
                try:
                    item[key] = datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    pass
    return item

# Stock data functions
def get_stock_data(symbols: List[str]) -> Dict[str, Any]:
    """Fetch current stock data from Yahoo Finance"""
    if not symbols:
        return {}
    
    try:
        tickers = yf.Tickers(' '.join(symbols))
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

# Routes
@api_router.get("/")
async def root():
    return {"message": "Portfolio Tracker API"}

# Stock prices
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

# Trades
@api_router.post("/trades", response_model=Trade)
async def create_trade(trade: TradeCreate):
    trade_dict = trade.dict()
    trade_dict['symbol'] = trade_dict['symbol'].upper()
    trade_obj = Trade(**trade_dict)
    
    # Prepare for MongoDB
    mongo_data = prepare_for_mongo(trade_obj.dict())
    await db.trades.insert_one(mongo_data)
    
    return trade_obj

@api_router.get("/trades", response_model=List[Trade])
async def get_trades():
    trades = await db.trades.find().sort("trade_date", -1).to_list(1000)
    return [Trade(**parse_from_mongo(trade)) for trade in trades]

@api_router.delete("/trades/{trade_id}")
async def delete_trade(trade_id: str):
    result = await db.trades.delete_one({"id": trade_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Trade not found")
    return {"message": "Trade deleted"}

# Portfolio
@api_router.get("/portfolio")
async def get_portfolio():
    trades = await db.trades.find().to_list(1000)
    
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

# Portfolio summary
@api_router.get("/portfolio/summary")
async def get_portfolio_summary():
    portfolio = await get_portfolio()
    
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

# Watchlist
@api_router.post("/watchlist", response_model=WatchlistItem)
async def add_to_watchlist(symbol: str):
    # Check if already in watchlist
    existing = await db.watchlist.find_one({"symbol": symbol.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Symbol already in watchlist")
    
    item = WatchlistItem(symbol=symbol.upper())
    mongo_data = prepare_for_mongo(item.dict())
    await db.watchlist.insert_one(mongo_data)
    
    return item

@api_router.get("/watchlist")
async def get_watchlist():
    watchlist = await db.watchlist.find().sort("added_at", -1).to_list(100)
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
async def remove_from_watchlist(symbol: str):
    result = await db.watchlist.delete_one({"symbol": symbol.upper()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Symbol not found in watchlist")
    return {"message": "Removed from watchlist"}

# Market overview
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