const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Mock automotive data - In production, this would connect to real APIs
const MOCK_VEHICLE_DATA = [
  { make: 'Toyota', model: 'Camry', year: 2023, type: 'sedan', demand_score: 95, seasonal_boost: 1.1 },
  { make: 'Honda', model: 'CR-V', year: 2023, type: 'suv', demand_score: 92, seasonal_boost: 1.2 },
  { make: 'Ford', model: 'F-150', year: 2023, type: 'truck', demand_score: 89, seasonal_boost: 1.0 },
  { make: 'Tesla', model: 'Model 3', year: 2023, type: 'electric', demand_score: 88, seasonal_boost: 1.15 },
  { make: 'Subaru', model: 'Outback', year: 2022, type: 'wagon', demand_score: 85, seasonal_boost: 1.3 },
  { make: 'BMW', model: 'X3', year: 2023, type: 'luxury_suv', demand_score: 82, seasonal_boost: 1.1 },
  { make: 'Mazda', model: 'CX-5', year: 2023, type: 'suv', demand_score: 80, seasonal_boost: 1.2 },
  { make: 'Jeep', model: 'Wrangler', year: 2022, type: 'suv', demand_score: 78, seasonal_boost: 1.4 },
  { make: 'Nissan', model: 'Altima', year: 2021, type: 'sedan', demand_score: 75, seasonal_boost: 1.0 },
  { make: 'Chevrolet', model: 'Tahoe', year: 2023, type: 'large_suv', demand_score: 73, seasonal_boost: 1.1 }
];

// AI Prediction Engine
class InventoryAI {
  constructor() {
    this.marketTrends = this.loadMarketTrends();
  }

  loadMarketTrends() {
    // Simulate real market data analysis
    return {
      electric_vehicle_boost: 1.25,
      suv_popularity: 1.2,
      luxury_market_softening: 0.9,
      supply_chain_factor: 1.1,
      gas_price_impact: 1.05
    };
  }

  calculateSellProbability(vehicle) {
    let score = vehicle.demand_score;
    
    // Apply seasonal factors
    score *= vehicle.seasonal_boost;
    
    // Apply market trend adjustments
    if (vehicle.type.includes('electric')) {
      score *= this.marketTrends.electric_vehicle_boost;
    }
    if (vehicle.type.includes('suv')) {
      score *= this.marketTrends.suv_popularity;
    }
    if (vehicle.type.includes('luxury')) {
      score *= this.marketTrends.luxury_market_softening;
    }
    
    // Age factor (newer cars sell faster)
    const currentYear = new Date().getFullYear();
    const ageBonus = Math.max(0.8, 1 - (currentYear - vehicle.year) * 0.1);
    score *= ageBonus;
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, score));
  }

  getTopRecommendations(count = 5, filters = {}) {
    let vehicles = [...MOCK_VEHICLE_DATA];
    
    // Apply filters
    if (filters.maxAge) {
      const minYear = new Date().getFullYear() - filters.maxAge;
      vehicles = vehicles.filter(v => v.year >= minYear);
    }
    if (filters.type) {
      vehicles = vehicles.filter(v => v.type.includes(filters.type));
    }
    
    // Calculate probabilities and sort
    const recommendations = vehicles.map(vehicle => ({
      ...vehicle,
      sell_probability: this.calculateSellProbability(vehicle),
      days_to_sell_estimate: Math.max(1, Math.round(50 - (this.calculateSellProbability(vehicle) * 0.4)))
    }));
    
    recommendations.sort((a, b) => b.sell_probability - a.sell_probability);
    
    return recommendations.slice(0, count);
  }
}

const inventoryAI = new InventoryAI();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'AI Inventory Advisor is running',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/recommendations', (req, res) => {
  try {
    const { count = 5, filters = {} } = req.body;
    
    const recommendations = inventoryAI.getTopRecommendations(count, filters);
    
    res.json({
      success: true,
      recommendations,
      analysis: {
        total_vehicles_analyzed: MOCK_VEHICLE_DATA.length,
        market_conditions: 'Favorable for SUVs and Electric Vehicles',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/api/market-trends', (req, res) => {
  res.json({
    trends: inventoryAI.marketTrends,
    insights: [
      'Electric vehicles showing 25% higher demand',
      'SUV market remains strong with 20% boost',
      'Luxury segment experiencing slight softening',
      'Supply chain improvements boosting availability'
    ],
    last_updated: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚗 AI Inventory Advisor running on port ${PORT}`);
  console.log(`📊 Ready to analyze automotive inventory data`);
});

module.exports = app;
