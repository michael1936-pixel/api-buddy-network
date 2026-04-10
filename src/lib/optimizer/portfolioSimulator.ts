import { SymbolData, PeriodSplit, ExtendedStocksStrategyParameters, PortfolioBacktestResult, MonthlyPerformance } from './types';

export function runPortfolioBacktest(
  _symbolsData: SymbolData[],
  _params: ExtendedStocksStrategyParameters,
  _periodSplit: PeriodSplit,
  _mode: string,
  _simulationConfig: any
): any {
  console.warn('portfolioSimulator stub - implement actual logic');
  return {
    totalTrainReturn: 0,
    totalTestReturn: 0,
    trainResults: [],
    testResults: [],
    monthlyPerformance: []
  };
}

export function calculateMonthlyPerformance(
  _results: PortfolioBacktestResult[],
  _phase: 'train' | 'test'
): MonthlyPerformance[] {
  return [];
}
