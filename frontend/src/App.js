import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
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
import { TrendingUp, TrendingDown, Plus, Minus, Eye, EyeOff, BarChart3, PieChart as PieChartIcon, Wallet, Target } from 'lucide-react';

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

// Navigation Component
const Navigation = () => {
  const location = useLocation();
  
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
        </div>
      </div>
    </nav>
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
const PortfolioHoldings = ({ portfolio }) => {
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
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(position.market_value)}</div>
                <div className={`flex items-center text-sm ${position.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {position.pnl >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  {formatCurrency(position.pnl)} ({formatPercentage(position.pnl_percentage)})
                </div>
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
      toast.error('Fehler beim Hinzufügen des Trades');
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
      toast.error('Fehler beim Laden der Daten');
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
            <PortfolioHoldings portfolio={portfolio} />
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
      toast.error('Fehler beim Laden der Trades');
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
      toast.error('Fehler beim Laden der Watchlist');
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
      toast.error('Fehler beim Hinzufügen zur Watchlist');
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
      <BrowserRouter>
        <div className="App">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trades" element={<TradesPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
          </Routes>
          <Toaster position="top-right" />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;