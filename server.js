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
  { make: 'Toyota', model: 'Camry', year: 2023, type: 'sedan', demand_score: 95, seasonal_boost: 1.1, avg_days_on_lot: 28 },
  { make: 'Honda', model: 'CR-V', year: 2023, type: 'suv', demand_score: 92, seasonal_boost: 1.2, avg_days_on_lot: 25 },
  { make: 'Ford', model: 'F-150', year: 2023, type: 'truck', demand_score: 89, seasonal_boost: 1.0, avg_days_on_lot: 32 },
  { make: 'Tesla', model: 'Model 3', year: 2023, type: 'electric', demand_score: 88, seasonal_boost: 1.15, avg_days_on_lot: 21 },
  { make: 'Subaru', model: 'Outback', year: 2022, type: 'wagon', demand_score: 85, seasonal_boost: 1.3, avg_days_on_lot: 35 },
  { make: 'BMW', model: 'X3', year: 2023, type: 'luxury_suv', demand_score: 82, seasonal_boost: 1.1, avg_days_on_lot: 45 },
  { make: 'Mazda', model: 'CX-5', year: 2023, type: 'suv', demand_score: 80, seasonal_boost: 1.2, avg_days_on_lot: 38 },
  { make: 'Jeep', model: 'Wrangler', year: 2022, type: 'suv', demand_score: 78, seasonal_boost: 1.4, avg_days_on_lot: 42 },
  { make: 'Nissan', model: 'Altima', year: 2021, type: 'sedan', demand_score: 75, seasonal_boost: 1.0, avg_days_on_lot: 55 },
  { make: 'Chevrolet', model: 'Tahoe', year: 2023, type: 'large_suv', demand_score: 73, seasonal_boost: 1.1, avg_days_on_lot: 48 }
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
      gas_price_impact: 1.05,
      current_month: new Date().getMonth() + 1 // 1-12
    };
  }

  getSeasonalMultiplier(vehicleType, month) {
    // Seasonal demand patterns
    const seasonalPatterns = {
      'convertible': month >= 4 && month <= 9 ? 1.3 : 0.7, // Spring/Summer boost
      'suv': month >= 10 || month <= 3 ? 1.2 : 1.0, // Fall/Winter boost
      'electric': month >= 3 && month <= 10 ? 1.15 : 1.05, // Better weather boost
      'truck': month >= 3 && month <= 8 ? 1.1 : 1.0, // Construction season
      'luxury': month === 12 || month === 1 ? 1.2 : 1.0 // Holiday season
    };

    return seasonalPatterns[vehicleType] || 1.0;
  }

  calculateConfidence(vehicle, sellProbability) {
    // Calculate confidence based on data quality and market stability
    let confidence = 85; // Base confidence

    // Higher confidence for popular makes
    if (['Toyota', 'Honda', 'Ford'].includes(vehicle.make)) {
      confidence += 10;
    }

    // Lower confidence for luxury vehicles (more volatile)
    if (vehicle.type.includes('luxury')) {
      confidence -= 15;
    }

    // Higher confidence for newer vehicles
    const age = new Date().getFullYear() - vehicle.year;
    confidence -= age * 5;

    // Adjust based on sell probability
    if (sellProbability > 90) confidence += 5;
    if (sellProbability < 70) confidence -= 10;

    return Math.max(60, Math.min(100, confidence));
  }

  calculateSellProbability(vehicle) {
    let score = vehicle.demand_score;
    
    // Apply base seasonal factors
    score *= vehicle.seasonal_boost;
    
    // Apply current season adjustment
    const seasonalMultiplier = this.getSeasonalMultiplier(vehicle.type, this.marketTrends.current_month);
    score *= seasonalMultiplier;
    
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
    const age = currentYear - vehicle.year;
    const ageMultiplier = Math.max(0.7, 1 - (age * 0.12)); // 12% penalty per year
    score *= ageMultiplier;
    
    // Days on lot factor (if available)
    if (vehicle.avg_days_on_lot) {
      const lotMultiplier = Math.max(0.6, 1 - (vehicle.avg_days_on_lot - 30) * 0.01);
      score *= lotMultiplier;
    }
    
    // Normalize to 0-100 scale
    return Math.min(100, Math.max(0, score));
  }

  calculateDaysToSell(vehicle, sellProbability) {
    // Base calculation using historical average
    let baseDays = vehicle.avg_days_on_lot || 40;
    
    // Adjust based on sell probability
    const probabilityFactor = (100 - sellProbability) / 100;
    const adjustedDays = baseDays * (0.5 + probabilityFactor);
    
    // Add some randomness to simulate market variability
    const randomFactor = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
    
    return Math.max(1, Math.round(adjustedDays * randomFactor));
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
    if (filters.maxDaysToSell) {
      // Pre-filter based on estimated days to sell
      vehicles = vehicles.filter(v => v.avg_days_on_lot <= filters.maxDaysToSell);
    }
    
    // Calculate probabilities and sort
    const recommendations = vehicles.map(vehicle => {
      const sellProbability = this.calculateSellProbability(vehicle);
      return {
        ...vehicle,
        sell_probability: sellProbability,
        days_to_sell_estimate: this.calculateDaysToSell(vehicle, sellProbability),
        confidence_score: this.calculateConfidence(vehicle, sellProbability)
      };
    });
    
    recommendations.sort((a, b) => {
      // Primary sort by sell probability, secondary by confidence
      if (Math.abs(a.sell_probability - b.sell_probability) < 2) {
        return b.confidence_score - a.confidence_score;
      }
      return b.sell_probability - a.sell_probability;
    });
    
    return recommendations.slice(0, count);
  }

  getMarketInsights() {
    const currentMonth = this.marketTrends.current_month;
    const insights = [];

    // Seasonal insights
    if (currentMonth >= 10 || currentMonth <= 3) {
      insights.push('Winter season: SUVs and AWD vehicles in high demand');
    } else if (currentMonth >= 4 && currentMonth <= 9) {
      insights.push('Spring/Summer: Convertibles and sportier vehicles trending up');
    }

    // Market trend insights
    insights.push(`Electric vehicles showing ${((this.marketTrends.electric_vehicle_boost - 1) * 100).toFixed(0)}% demand boost`);
    insights.push(`SUV market ${this.marketTrends.suv_popularity > 1 ? 'strong' : 'softening'} with ${((this.marketTrends.suv_popularity - 1) * 100).toFixed(0)}% adjustment`);
    
    if (this.marketTrends.luxury_market_softening < 1) {
      insights.push('Luxury segment experiencing headwinds - price sensitivity increasing');
    }

    return insights;
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
        market_conditions: 'AI analysis complete - see insights below',
        market_insights: inventoryAI.getMarketInsights(),
        generated_at: new Date().toISOString(),
        filters_applied: filters
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
    insights: inventoryAI.getMarketInsights(),
    seasonal_factors: {
      current_month: inventoryAI.marketTrends.current_month,
      season: inventoryAI.marketTrends.current_month >= 10 || inventoryAI.marketTrends.current_month <= 3 ? 'Winter' : 'Spring/Summer'
    },
    last_updated: new Date().toISOString()
  });
});

// New endpoint for quick recommendations
app.get('/api/quick-picks/:days', (req, res) => {
  try {
    const targetDays = parseInt(req.params.days) || 7;
    
    const recommendations = inventoryAI.getTopRecommendations(10, {})
      .filter(vehicle => vehicle.days_to_sell_estimate <= targetDays)
      .slice(0, 5);
    
    res.json({
      success: true,
      target_days: targetDays,
      found_count: recommendations.length,
      recommendations,
      message: `Vehicles most likely to sell within ${targetDays} days`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚗 AI Inventory Advisor running on port ${PORT}`);
  console.log(`📊 Ready to analyze automotive inventory data`);
  console.log(`🎯 Try: GET /api/quick-picks/7 for vehicles likely to sell in 7 days`);
});

module.exports = app;
