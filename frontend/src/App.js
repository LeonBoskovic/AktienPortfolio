import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import axios from 'axios';
import './App.css';

// Components imports
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Badge } from './components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Minus, 
  Eye, 
  EyeOff, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Wallet, 
  Target,
  LogOut,
  User,
  Trash2,
  X
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Auth Context
const AuthContext = createContext({
  user: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isLoading: true
});

// Auth Provider
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for session ID in URL fragment (Emergent OAuth callback)
  useEffect(() => {
    const checkSessionId = async () => {
      const hash = window.location.hash;
      if (hash.includes('session_id=')) {
        setIsLoading(true);
        const sessionId = hash.split('session_id=')[1].split('&')[0];
        
        try {
          const response = await axios.post(`${API}/auth/google`, {}, {
            headers: { 'X-Session-ID': sessionId }
          });
          
          setUser(response.data.user);
          
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast.success('Erfolgreich angemeldet!');
        } catch (error) {
          console.error('Google auth error:', error);
          toast.error('Anmeldung fehlgeschlagen');
        } finally {
          setIsLoading(false);
        }
        return;
      }
      
      // Check existing session
      checkExistingSession();
    };
    
    checkSessionId();
  }, []);

  const checkExistingSession = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        withCredentials: true
      });
      setUser(response.data);
    } catch (error) {
      console.log('No existing session');
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, {
        withCredentials: true
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      toast.success('Abgemeldet');
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      isAuthenticated: !!user,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

// Configure axios defaults
axios.defaults.withCredentials = true;

// Mock chart data for demonstration
const mockChartData = [
  { name: 'Jan', value: 10000 },
  { name: 'Feb', value: 10500 },
  { name: 'Mar', value: 11200 },
  { name: 'Apr', value: 10800 },
  { name: 'May', value: 12100 },
  { name: 'Jun', value: 13400 },
  { name: 'Jul', value: 14200 }
];

const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }
  
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

// Navigation Component
const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PortfolioTracker</span>
            </Link>
            
            <div className="hidden md:flex space-x-1">
              <Link
                to="/"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === '/'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Dashboard
              </Link>
              <Link
                to="/trades"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === '/trades'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Trades
              </Link>
              <Link
                to="/watchlist"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  location.pathname === '/watchlist'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Watchlist
              </Link>
            </div>
          </div>
          
          {user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Hallo, {user.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="text-gray-600 hover:text-gray-900"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

// Login/Register Component
const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const data = isLogin 
        ? { email: formData.email, password: formData.password }
        : formData;

      const response = await axios.post(`${API}${endpoint}`, data);
      
      if (isLogin) {
        login(response.data.user);
        toast.success('Erfolgreich angemeldet!');
      } else {
        toast.success('Registrierung erfolgreich! Bitte melden Sie sich an.');
        setIsLogin(true);
        setFormData({ email: '', name: '', password: '' });
      }
    } catch (error) {
      const message = error.response?.data?.detail || 'Ein Fehler ist aufgetreten';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const redirectUrl = encodeURIComponent(window.location.origin);
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">
            {isLogin ? 'Anmelden' : 'Registrieren'}
          </h2>
          <p className="mt-2 text-gray-600">
            {isLogin 
              ? 'Melden Sie sich in Ihrem Portfolio an' 
              : 'Erstellen Sie Ihr Portfolio-Konto'
            }
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-Mail</Label>
            <Input
              id="email"
              data-testid="auth-email-input"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          {!isLogin && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                data-testid="auth-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label htmlFor="password">Passwort</Label>
            <Input
              id="password"
              data-testid="auth-password-input"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <Button 
            type="submit" 
            data-testid="auth-submit-button"
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading 
              ? (isLogin ? 'Wird angemeldet...' : 'Wird registriert...') 
              : (isLogin ? 'Anmelden' : 'Registrieren')
            }
          </Button>
        </form>

        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">oder</span>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            variant="outline"
            className="w-full mt-4"
            data-testid="google-login-button"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Mit Google anmelden
          </Button>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setFormData({ email: '', name: '', password: '' });
            }}
            className="text-emerald-600 hover:text-emerald-500 text-sm"
          >
            {isLogin 
              ? 'Noch kein Konto? Hier registrieren' 
              : 'Bereits ein Konto? Hier anmelden'
            }
          </button>
        </div>
      </div>
    </div>
  );
};

// Portfolio Summary Component
const PortfolioSummary = ({ summary }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Portfolio Wert</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.total_value)}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Gesamt P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(summary.total_pnl)}
          </div>
          <p className={`text-sm ${summary.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatPercentage(summary.total_pnl_percentage)}
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Investiert</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(summary.total_cost)}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">Positionen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.positions_count}</div>
        </CardContent>
      </Card>
    </div>
  );
};

// Portfolio Holdings Component
const PortfolioHoldings = ({ portfolio, onRefresh }) => {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const closePosition = async (symbol) => {
    if (!window.confirm(`Möchten Sie die Position ${symbol} wirklich schließen? Alle Trades für diese Aktie werden gelöscht.`)) {
      return;
    }

    try {
      await axios.delete(`${API}/portfolio/${symbol}`);
      toast.success(`Position ${symbol} geschlossen`);
      onRefresh?.();
    } catch (error) {
      toast.error('Fehler beim Schließen der Position');
      console.error(error);
    }
  };

  if (!portfolio || portfolio.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dein Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">Noch keine Positionen vorhanden. Füge deinen ersten Trade hinzu!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Deine Positionen</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {portfolio.map((position) => (
            <div key={position.symbol} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-lg">{position.symbol}</h3>
                  <Badge variant="secondary">{position.total_quantity} Aktien</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  Ø {formatCurrency(position.avg_price)} • Aktuell {formatCurrency(position.current_price)}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-semibold">{formatCurrency(position.market_value)}</div>
                  <div className={`flex items-center text-sm ${position.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {position.pnl >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {formatCurrency(position.pnl)} ({formatPercentage(position.pnl_percentage)})
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => closePosition(position.symbol)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`close-position-${position.symbol}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Add Trade Form Component
const AddTradeForm = ({ onTradeAdded }) => {
  const [formData, setFormData] = useState({
    symbol: '',
    quantity: '',
    price: '',
    trade_type: 'buy'
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.symbol || !formData.quantity || !formData.price) {
      toast.error('Bitte alle Felder ausfüllen');
      return;
    }

    setIsLoading(true);
    try {
      await axios.post(`${API}/trades`, {
        ...formData,
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price)
      });
      
      toast.success('Trade hinzugefügt!');
      setFormData({ symbol: '', quantity: '', price: '', trade_type: 'buy' });
      onTradeAdded?.();
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Hinzufügen des Trades';
      toast.error(message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Neuer Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                data-testid="trade-symbol-input"
                placeholder="z.B. AAPL"
                value={formData.symbol}
                onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <Label htmlFor="trade_type">Typ</Label>
              <Select
                data-testid="trade-type-select"
                value={formData.trade_type}
                onValueChange={(value) => setFormData({ ...formData, trade_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Kauf</SelectItem>
                  <SelectItem value="sell">Verkauf</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="quantity">Anzahl</Label>
              <Input
                id="quantity"
                data-testid="trade-quantity-input"
                type="number"
                step="0.01"
                placeholder="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="price">Preis ($)</Label>
              <Input
                id="price"
                data-testid="trade-price-input"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            data-testid="add-trade-button"
            className="w-full" 
            disabled={isLoading}
          >
            {isLoading ? 'Wird hinzugefügt...' : 'Trade hinzufügen'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

// Dashboard Component
const Dashboard = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [summary, setSummary] = useState({
    total_value: 0,
    total_cost: 0,
    total_pnl: 0,
    total_pnl_percentage: 0,
    positions_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [portfolioRes, summaryRes] = await Promise.all([
        axios.get(`${API}/portfolio`),
        axios.get(`${API}/portfolio/summary`)
      ]);
      
      setPortfolio(portfolioRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      const message = error.response?.status === 401 
        ? 'Bitte melden Sie sich an'
        : 'Fehler beim Laden der Daten';
      toast.error(message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const prepareChartData = () => {
    return portfolio.map((pos, index) => ({
      name: pos.symbol,
      value: pos.market_value,
      fill: colors[index % colors.length]
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Lade Portfolio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Dein Portfolio im Blick
            </h1>
            <p className="text-xl md:text-2xl text-emerald-100 max-w-2xl mx-auto">
              Verfolge deine Aktien-Trades live mit modernem Design und Echtzeit-Daten
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PortfolioSummary summary={summary} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          <div className="lg:col-span-2">
            <PortfolioHoldings portfolio={portfolio} onRefresh={fetchData} />
          </div>
          
          <div className="space-y-6">
            <AddTradeForm onTradeAdded={fetchData} />
            
            {portfolio.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Portfolio Verteilung</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={prepareChartData()}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                      >
                        {prepareChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Portfolio Performance Chart */}
        {portfolio.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Portfolio Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                  <Line 
                    type="monotone" 
                    dataKey="value" 
                    stroke="#10B981" 
                    strokeWidth={3}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// Trades Page Component
const TradesPage = () => {
  const [trades, setTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      const response = await axios.get(`${API}/trades`);
      setTrades(response.data);
    } catch (error) {
      const message = error.response?.status === 401 
        ? 'Bitte melden Sie sich an'
        : 'Fehler beim Laden der Trades';
      toast.error(message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteTrade = async (tradeId) => {
    try {
      await axios.delete(`${API}/trades/${tradeId}`);
      toast.success('Trade gelöscht');
      fetchTrades();
    } catch (error) {
      toast.error('Fehler beim Löschen');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Trade Historie</h1>
          <p className="text-gray-600 mt-2">Alle deine Käufe und Verkäufe im Überblick</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Alle Trades</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Lade Trades...</p>
                  </div>
                ) : trades.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Noch keine Trades vorhanden</p>
                ) : (
                  <div className="space-y-3">
                    {trades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${trade.trade_type === 'buy' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {trade.trade_type === 'buy' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h3 className="font-semibold">{trade.symbol}</h3>
                              <Badge variant={trade.trade_type === 'buy' ? 'default' : 'destructive'}>
                                {trade.trade_type === 'buy' ? 'Kauf' : 'Verkauf'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600">
                              {trade.quantity} Aktien @ {formatCurrency(trade.price)} • {formatDate(trade.trade_date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(trade.quantity * trade.price)}</div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => deleteTrade(trade.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Löschen
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <AddTradeForm onTradeAdded={fetchTrades} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Watchlist Page Component
const WatchlistPage = () => {
  const [watchlist, setWatchlist] = useState([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  const fetchWatchlist = async () => {
    try {
      const response = await axios.get(`${API}/watchlist`);
      setWatchlist(response.data);
    } catch (error) {
      const message = error.response?.status === 401 
        ? 'Bitte melden Sie sich an'
        : 'Fehler beim Laden der Watchlist';
      toast.error(message);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const addToWatchlist = async (e) => {
    e.preventDefault();
    if (!newSymbol) return;

    setIsAdding(true);
    try {
      await axios.post(`${API}/watchlist?symbol=${newSymbol.toUpperCase()}`);
      toast.success('Aktie zur Watchlist hinzugefügt');
      setNewSymbol('');
      fetchWatchlist();
    } catch (error) {
      const message = error.response?.data?.detail || 'Fehler beim Hinzufügen zur Watchlist';
      toast.error(message);
      console.error(error);
    } finally {
      setIsAdding(false);
    }
  };

  const removeFromWatchlist = async (symbol) => {
    try {
      await axios.delete(`${API}/watchlist/${symbol}`);
      toast.success('Von Watchlist entfernt');
      fetchWatchlist();
    } catch (error) {
      toast.error('Fehler beim Entfernen');
      console.error(error);
    }
  };

  useEffect(() => {
    fetchWatchlist();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchWatchlist, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Watchlist</h1>
          <p className="text-gray-600 mt-2">Beobachte interessante Aktien</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Beobachtete Aktien</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Lade Watchlist...</p>
                  </div>
                ) : watchlist.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Noch keine Aktien in der Watchlist</p>
                ) : (
                  <div className="space-y-3">
                    {watchlist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div>
                          <h3 className="font-semibold text-lg">{item.symbol}</h3>
                          <p className="text-sm text-gray-600">
                            Hinzugefügt: {new Date(item.added_at).toLocaleDateString('de-DE')}
                          </p>
                        </div>
                        <div className="text-right flex items-center space-x-4">
                          <div>
                            <div className="font-semibold">{formatCurrency(item.current_price)}</div>
                            {item.change !== null && (
                              <div className={`flex items-center text-sm ${item.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {item.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                                {formatCurrency(item.change)} ({formatPercentage(item.change_percent)})
                              </div>
                            )}
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => removeFromWatchlist(item.symbol)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <EyeOff className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Aktie hinzufügen</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={addToWatchlist} className="space-y-4">
                  <div>
                    <Label htmlFor="symbol">Symbol</Label>
                    <Input
                      id="symbol"
                      data-testid="watchlist-symbol-input"
                      placeholder="z.B. AAPL"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    data-testid="add-to-watchlist-button"
                    className="w-full" 
                    disabled={isAdding || !newSymbol}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {isAdding ? 'Wird hinzugefügt...' : 'Zur Watchlist hinzufügen'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <div className="App">
            <Routes>
              <Route 
                path="/login" 
                element={<AuthPage />}
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/trades" 
                element={
                  <ProtectedRoute>
                    <TradesPage />
                  </ProtectedRoute>
                }
              />
              <Route 
                path="/watchlist" 
                element={
                  <ProtectedRoute>
                    <WatchlistPage />
                  </ProtectedRoute>
                }
              />
            </Routes>
            <Toaster position="top-right" />
          </div>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;