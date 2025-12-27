const {
  default: makeWASocket,
  useSingleFileAuthState,
  downloadMediaMessage
} = require('@whiskeysockets/baileys')

const P = require('pino')
const fs = require('fs')

if (!fs.existsSync('./advs.json')) fs.writeFileSync('./advs.json', '{}')
const advs = JSON.parse(fs.readFileSync('./advs.json'))
const jogos = {}

const saveAdvs = () =>
  fs.writeFileSync('./advs.json', JSON.stringify(advs, null, 2))

const delay = ms => new Promise(r => setTimeout(r, ms))
const rand = n => Math.floor(Math.random() * n)

async function startBot() {
  const { state, saveState } = useSingleFileAuthState('./auth.json')

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveState)

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    if (!from.endsWith('@g.us')) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      ''

    const sender = msg.key.participant
    const metadata = await sock.groupMetadata(from)
    const participants = metadata.participants
    const admins = participants.filter(p => p.admin).map(p => p.id)

    const isAdmin = admins.includes(sender)
    const botAdmin = admins.includes(sock.user.id)

    const mentions =
      msg.message.extendedTextMessage?.contextInfo?.mentionedJid || []
    const alvo = mentions[0]

    const reply = (text, m = []) =>
      sock.sendMessage(from, { text, mentions: m }, { quoted: msg })

    /* ================= FIGURINHA ================= */
    if (texto === '!s') {
      const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage
      if (!quoted)
        return reply(
          '🖼️ *CRIAR FIGURINHA*\n\n' +
          'Para criar uma figurinha, responda uma *imagem ou vídeo* com o comando:\n\n' +
          '`!s`'
        )

      await reply('🛠️ Processando mídia...\n⏳ Criando figurinha, aguarde...')

      const media = await downloadMediaMessage(
        {
          message: quoted,
          key: msg.key
        },
        'buffer',
        {},
        { logger: P({ level: 'silent' }) }
      )

      await delay(3000)

      return sock.sendMessage(from, {
        sticker: media
      })
    }

    /* ================= MENU ================= */
    if (texto === '!menu') {
      return reply(
`🤖══════════════════════🤖
        🤖 MENU DO BOT 🤖
🤖══════════════════════🤖

👮 ADMINISTRAÇÃO
!adm @user
!rebaixar @user
!ban @user
!adv @user
!unadv @user
!veradv @user
!fechar / !abrir
!setnome texto
!setdesc texto
!todos
!sorteio

🎮 JOGOS
!adivinhar
!roleta
!sorte
!jogodavelha

😂 BRINCADEIRAS
!gado
!gay
!match
!fake
!ppp

🖼️ FIGURINHA
!s (responder imagem ou vídeo)

⚠️ Apenas ADM usa comandos administrativos`
      )
    }

    if (!botAdmin) return
    if (!isAdmin && texto.startsWith('!')) return

    /* ================= ADM ================= */
    if (texto.startsWith('!adm')) {
      await reply('🔄 Processando promoção de administrador...')
      await delay(4000)
      await sock.groupParticipantsUpdate(from, [alvo], 'promote')
      return reply(`✅ Promoção concluída.\n👮 @${alvo.split('@')[0]} agora é ADMIN.`, [alvo])
    }

    if (texto.startsWith('!rebaixar')) {
      await reply('🔄 Processando rebaixamento de cargo...')
      await delay(4000)
      await sock.groupParticipantsUpdate(from, [alvo], 'demote')
      return reply('✅ Cargo removido.', [alvo])
    }

    if (texto.startsWith('!ban')) {
      await reply('⚠️ Removendo usuário do grupo...')
      await delay(4000)
      await sock.groupParticipantsUpdate(from, [alvo], 'remove')
      return reply('🚫 Usuário removido com sucesso.')
    }

    /* ================= ADV ================= */
    if (texto.startsWith('!adv')) {
      advs[alvo] = (advs[alvo] || 0) + 1
      saveAdvs()

      await reply(
        `⚠️ Aplicando advertência em @${alvo.split('@')[0]}...\n📋 Registrando no sistema.`,
        [alvo]
      )
      await delay(4000)

      if (advs[alvo] >= 3) {
        advs[alvo] = 0
        saveAdvs()
        await sock.groupParticipantsUpdate(from, [alvo], 'remove')
        return reply(
          `🚫 LIMITE ATINGIDO!\n@${alvo.split('@')[0]} foi removido após 3 advertências.`,
          [alvo]
        )
      }

      return reply(
        `✅ Advertência aplicada com sucesso.\n📊 Total atual: ${advs[alvo]}/3`,
        [alvo]
      )
    }

    if (texto.startsWith('!unadv')) {
      await reply('🧹 Limpando advertências...')
      await delay(3000)
      advs[alvo] = 0
      saveAdvs()
      return reply('✅ Advertências removidas.', [alvo])
    }

    if (texto.startsWith('!veradv')) {
      return reply(
        `📋 O usuário possui ${advs[alvo] || 0}/3 advertências.`,
        [alvo]
      )
    }

    /* ================= JOGOS ================= */
    if (texto === '!adivinhar') {
      jogos[from] = rand(50) + 1
      return reply(
        '🎯 JOGO INICIADO!\nPensei em um número entre 1 e 50.\nQuem acertar primeiro vence.'
      )
    }

    if (jogos[from]) {
      const n = parseInt(texto)
      if (n === jogos[from]) {
        delete jogos[from]
        return reply(
          `🏆 PARABÉNS!\n@${sender.split('@')[0]} acertou o número!`,
          [sender]
        )
      }
    }

    /* ================= BRINCADEIRAS ================= */
    if (texto === '!gado')
      return reply(`🐂 Medidor de gado:\n${rand(101)}% 🤠`, [sender])

    if (texto === '!gay')
      return reply(`🏳️‍🌈 Medidor gay:\n${rand(101)}% 🌈`, [sender])

    if (texto === '!match') {
      const m = participants[rand(participants.length)].id
      return reply(
        `💖 MATCH DO DIA!\n@${sender.split('@')[0]} ❤️ @${m.split('@')[0]}`,
        [sender, m]
      )
    }

    if (texto === '!fake')
      return reply(
        `📰 BOATO DO DIA\n@${sender.split('@')[0]} anda aprontando 👀`,
        [sender]
      )

    if (texto === '!ppp') {
      const r = ['PEGO 😈', 'PASSO 😐', 'PENSO 🤔'][rand(3)]
      return reply(`🔥 PPP RESULTADO\n${r}`, [sender])
    }
  })

  sock.ev.on('connection.update', ({ connection }) => {
    if (connection === 'open') console.log('✅ BOT ONLINE')
  })
}

startBot()
