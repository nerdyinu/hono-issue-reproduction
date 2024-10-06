import { Prisma, PrismaClient } from '@prisma/client'
import { Hono } from 'hono'
import { validateWord } from '../utils/dictionaryApi'
import { evaluateGuess } from '../utils/gameLogic'
import { Context } from '../utils/hono'
import { GameState, GuessResult } from '../utils/types'
import { decrypt, encrypt } from '../utils/wordEncryption'

const gameRoutes = new Hono<Context>()

gameRoutes.post('/start', async (c) => {
  const prisma = c.get('prisma')
  const fixedWord = 'WORLD'
  const encryptedWord = encrypt(fixedWord)

  const game = await prisma.game.create({
    data: {
      word: encryptedWord,
    }
  })
  const gameHash = encrypt(game.id)
  return c.json({ hash: gameHash })
})

gameRoutes.post('/create', async (c) => {
  const prisma = c.get('prisma') as PrismaClient
  const { word } = await c.req.json()

  if (word.length !== 5) {
    return c.json({ error: '단어는 5글자여야 합니다.' }, 400)
  }

  if (!(await validateWord(word))) {
    return c.json({ error: '유효한 단어가 아닙니다.' }, 400)
  }

  const encryptedWord = encrypt(word.toUpperCase())
  const game = await prisma.game.create({
    data: {
      word: encryptedWord,
    }
  })

  const gameHash = encrypt(game.id)

  return c.json({ hash: gameHash })
})

gameRoutes.get('/play/:hash', async (c) => {
  const prisma = c.get('prisma') as PrismaClient
  const hash = c.req.param('hash')
  const gameId = decrypt(hash)

  const game = await prisma.game.findUnique({
    where: { id: gameId }
  })

  if (!game) {
    return c.json({ error: '게임을 찾을 수 없습니다.' }, 404)
  }


  return c.json({
    ...game,
    results: game.results as GuessResult[]
  } satisfies GameState)
});


gameRoutes.post('/:hash/guess', async (c) => {
  const prisma = c.get('prisma') as PrismaClient
  const { guess } = await c.req.json()
  const hash = c.req.param('hash');
  const id = decrypt(hash)
  const game = await prisma.game.findUnique({
    where: { id }
  })

  if (!game) {
    return c.json({ error: '게임을 찾을 수 없습니다.' }, 404)
  }

  if (game.isCompleted) {
    return c.json({ error: '게임이 이미 종료되었습니다.' }, 400)
  }

  if (!(await validateWord(guess))) {
    return c.json({ error: '단어를 찾을 수 없습니다.' }, 400)
  }

  const word = decrypt(game.word)
  const result = evaluateGuess(guess, word)

  const updatedGuesses = [...game.guesses, guess]
  const updatedResults = [...(game.results), result] as Prisma.JsonArray[]
  const isVictory = guess === word
  const isCompleted = isVictory || updatedGuesses.length >= 6

  const now = new Date()

  await prisma.game.update({
    where: { id: game.id },
    data: {
      guesses: updatedGuesses,
      isCompleted,
      isVictory,
      results: updatedResults,
      completedAt: isCompleted ? now : undefined
    }
  })

  if (isCompleted) {
    await updateStatistics(prisma, isVictory, updatedGuesses.length)
  }

  return c.json({ result, isCompleted, isVictory })
})

async function updateStatistics(prisma: PrismaClient, isVictory: boolean, guessCount: number) {
  const stats = await prisma.gameStatistics.findFirst()

  if (stats) {
    await prisma.gameStatistics.update({
      where: { id: stats.id },
      data: {
        totalGames: { increment: 1 },
        totalVictories: isVictory ? { increment: 1 } : undefined,
        guessCounts: { push: guessCount }
      }
    })
  } else {
    await prisma.gameStatistics.create({
      data: {
        totalGames: 1,
        totalVictories: isVictory ? 1 : 0,
        guessCounts: [guessCount]
      }
    })
  }
}

export { gameRoutes }
