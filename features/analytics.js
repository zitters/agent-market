// Market Analytics Module
// Data-driven insights for AgentMarket participants

export class MarketAnalytics {
  constructor() {
    this.priceHistory = new Map()
    this.volumeData = new Map()
    this.serviceStats = new Map()
  }

  /**
   * Track service listing
   * @param {Object} service - Service details
   */
  trackListing(service) {
    const category = this.categorizeService(service.name)
    
    // Initialize category stats if needed
    if (!this.serviceStats.has(category)) {
      this.serviceStats.set(category, {
        count: 0,
        totalValue: 0,
        prices: [],
        providers: new Set()
      })
    }
    
    const stats = this.serviceStats.get(category)
    stats.count++
    stats.prices.push(service.price)
    stats.providers.add(service.provider)
    
    // Track price history
    if (!this.priceHistory.has(category)) {
      this.priceHistory.set(category, [])
    }
    this.priceHistory.get(category).push({
      price: service.price,
      timestamp: service.timestamp
    })
  }

  /**
   * Track completed order
   * @param {Object} order - Order details
   */
  trackOrder(order) {
    const category = this.categorizeService(order.serviceName)
    
    // Update volume data
    if (!this.volumeData.has(category)) {
      this.volumeData.set(category, {
        totalOrders: 0,
        totalValue: 0,
        averageOrderValue: 0
      })
    }
    
    const volume = this.volumeData.get(category)
    volume.totalOrders++
    volume.totalValue += order.price
    volume.averageOrderValue = volume.totalValue / volume.totalOrders
  }

  /**
   * Get market statistics for a category
   * @param {string} category - Service category
   * @returns {Object} Market stats
   */
  getMarketStats(category) {
    const stats = this.serviceStats.get(category)
    
    if (!stats || stats.prices.length === 0) {
      return {
        category,
        available: 0,
        averagePrice: 0,
        minPrice: 0,
        maxPrice: 0,
        providers: 0,
        message: 'No data available for this category'
      }
    }
    
    const prices = stats.prices
    const sum = prices.reduce((a, b) => a + b, 0)
    
    return {
      category,
      available: stats.count,
      averagePrice: Math.round((sum / prices.length) * 100) / 100,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      medianPrice: this.calculateMedian(prices),
      providers: stats.providers.size,
      priceRange: Math.max(...prices) - Math.min(...prices)
    }
  }

  /**
   * Get price trend for category
   * @param {string} category - Service category
   * @param {number} timeWindow - Time window in ms (default 24h)
   * @returns {Object} Price trend
   */
  getPriceTrend(category, timeWindow = 86400000) {
    const history = this.priceHistory.get(category) || []
    const now = Date.now()
    
    // Filter to time window
    const recentPrices = history.filter(
      entry => (now - entry.timestamp) <= timeWindow
    )
    
    if (recentPrices.length < 2) {
      return {
        trend: 'insufficient_data',
        change: 0,
        direction: 'stable'
      }
    }
    
    // Calculate trend
    const oldPrice = recentPrices[0].price
    const newPrice = recentPrices[recentPrices.length - 1].price
    const change = ((newPrice - oldPrice) / oldPrice) * 100
    
    let direction = 'stable'
    if (change > 5) direction = 'rising'
    if (change < -5) direction = 'falling'
    
    return {
      trend: direction,
      change: Math.round(change * 100) / 100,
      oldPrice,
      newPrice,
      dataPoints: recentPrices.length
    }
  }

  /**
   * Get top services by volume
   * @param {number} limit - Number of results
   * @returns {Array} Top services
   */
  getTopServices(limit = 10) {
    const services = []
    
    this.volumeData.forEach((data, category) => {
      services.push({
        category,
        totalOrders: data.totalOrders,
        totalValue: data.totalValue,
        averageValue: data.averageOrderValue
      })
    })
    
    return services
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, limit)
  }

  /**
   * Calculate price competitiveness score
   * @param {number} price - Your price
   * @param {string} category - Service category
   * @returns {Object} Competitiveness analysis
   */
  analyzeCompetitiveness(price, category) {
    const stats = this.getMarketStats(category)
    
    if (stats.available === 0) {
      return {
        score: 50,
        position: 'unknown',
        message: 'No market data available'
      }
    }
    
    let score = 50
    let position = 'average'
    
    // Calculate percentile
    const percentile = ((stats.maxPrice - price) / (stats.maxPrice - stats.minPrice)) * 100
    
    if (price <= stats.minPrice) {
      score = 100
      position = 'highly_competitive'
    } else if (price < stats.averagePrice) {
      score = 60 + (percentile * 0.4)
      position = 'competitive'
    } else if (price === stats.averagePrice) {
      score = 50
      position = 'average'
    } else if (price < stats.maxPrice) {
      score = 30 + ((100 - percentile) * 0.2)
      position = 'above_average'
    } else {
      score = 20
      position = 'premium'
    }
    
    return {
      score: Math.round(score),
      position,
      marketAverage: stats.averagePrice,
      yourPrice: price,
      difference: price - stats.averagePrice,
      suggestion: this.generatePricingSuggestion(price, stats)
    }
  }

  /**
   * Generate pricing suggestion
   * @param {number} currentPrice - Current price
   * @param {Object} stats - Market statistics
   * @returns {string} Pricing advice
   */
  generatePricingSuggestion(currentPrice, stats) {
    const diff = currentPrice - stats.averagePrice
    const diffPercent = (diff / stats.averagePrice) * 100
    
    if (diffPercent > 20) {
      return `Consider lowering price to ${Math.round(stats.averagePrice * 1.1)} TNK for better competitiveness`
    } else if (diffPercent > 10) {
      return `Price is slightly high. Market average is ${stats.averagePrice} TNK`
    } else if (diffPercent < -10) {
      return `You could increase price to ${Math.round(stats.averagePrice * 0.95)} TNK while staying competitive`
    } else {
      return `Price is well-positioned in the market`
    }
  }

  /**
   * Predict demand for service
   * @param {string} category - Service category
   * @returns {Object} Demand prediction
   */
  predictDemand(category) {
    const volume = this.volumeData.get(category)
    const stats = this.serviceStats.get(category)
    
    if (!volume || !stats) {
      return {
        level: 'unknown',
        confidence: 0,
        message: 'Insufficient data for prediction'
      }
    }
    
    // Simple demand calculation
    const supplyDemandRatio = volume.totalOrders / stats.count
    
    let level = 'medium'
    let confidence = 50
    
    if (supplyDemandRatio > 3) {
      level = 'high'
      confidence = 80
    } else if (supplyDemandRatio > 1.5) {
      level = 'medium-high'
      confidence = 70
    } else if (supplyDemandRatio < 0.5) {
      level = 'low'
      confidence = 75
    }
    
    return {
      level,
      confidence,
      supplyDemandRatio,
      totalOrders: volume.totalOrders,
      totalListings: stats.count,
      recommendation: this.generateDemandRecommendation(level)
    }
  }

  /**
   * Generate recommendation based on demand
   * @param {string} demandLevel - Demand level
   * @returns {string} Recommendation
   */
  generateDemandRecommendation(demandLevel) {
    const recommendations = {
      high: 'Excellent opportunity! Consider increasing capacity or price',
      'medium-high': 'Good demand. Maintain quality and consider premium pricing',
      medium: 'Stable market. Focus on differentiation and quality',
      'medium-low': 'Lower demand. Consider promotional pricing or service improvements',
      low: 'Oversupplied market. Differentiate or consider other service categories'
    }
    
    return recommendations[demandLevel] || recommendations.medium
  }

  /**
   * Categorize service by name
   * @param {string} serviceName - Service name
   * @returns {string} Category
   */
  categorizeService(serviceName) {
    const name = serviceName.toLowerCase()
    
    if (name.includes('code') || name.includes('develop') || name.includes('program')) {
      return 'development'
    }
    if (name.includes('data') || name.includes('analysis') || name.includes('analytics')) {
      return 'data_analysis'
    }
    if (name.includes('design') || name.includes('ui') || name.includes('ux')) {
      return 'design'
    }
    if (name.includes('content') || name.includes('writing') || name.includes('copy')) {
      return 'content_creation'
    }
    if (name.includes('image') || name.includes('video') || name.includes('render')) {
      return 'media_generation'
    }
    if (name.includes('review') || name.includes('audit') || name.includes('check')) {
      return 'review_services'
    }
    
    return 'general'
  }

  /**
   * Calculate median of array
   * @param {Array} arr - Number array
   * @returns {number} Median value
   */
  calculateMedian(arr) {
    const sorted = [...arr].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2
    }
    return sorted[mid]
  }

  /**
   * Generate market report
   * @returns {Object} Comprehensive market report
   */
  generateMarketReport() {
    const report = {
      timestamp: Date.now(),
      categories: [],
      topServices: this.getTopServices(5),
      totalListings: 0,
      totalOrders: 0,
      totalVolume: 0
    }
    
    this.serviceStats.forEach((stats, category) => {
      const marketStats = this.getMarketStats(category)
      const volume = this.volumeData.get(category) || { totalOrders: 0, totalValue: 0 }
      const trend = this.getPriceTrend(category)
      const demand = this.predictDemand(category)
      
      report.categories.push({
        category,
        stats: marketStats,
        volume,
        trend,
        demand
      })
      
      report.totalListings += stats.count
      report.totalOrders += volume.totalOrders
      report.totalVolume += volume.totalValue
    })
    
    return report
  }
}

export default MarketAnalytics
