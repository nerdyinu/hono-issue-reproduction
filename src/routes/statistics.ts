import { Hono } from 'hono';
import { Context } from '../utils/hono';
import { Statistics } from '../utils/types';

const statisticsRoutes = new Hono<Context>()

statisticsRoutes.get('/', async (c) => {
  const prisma = c.get('prisma');

  const stats = await prisma.gameStatistics.findFirst()

  if (!stats) {
    return c.json({ error: '통계를 찾을 수 없습니다.' }, 404)
  }

  const winRate = stats.totalGames > 0 ? (stats.totalVictories / stats.totalGames) * 100 : 0

  const distribution = stats.guessCounts.reduce((acc: Record<number, number>, count: number) => {
    acc[count] = (acc[count] || 0) + 1
    return acc
  }, {})

  return c.json({
    totalGames: stats.totalGames,
    totalVictories: stats.totalVictories,
    winRate: winRate.toFixed(2),
    guessDistribution: distribution
  } satisfies Statistics)
})

export { statisticsRoutes };
