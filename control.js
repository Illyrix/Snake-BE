const crypto = require('crypto')
const { defaultMap, Map } = require('./logic/map')
const { Snake } = require('./logic/snake')

const NAMES = require('./config').NAMES
const REFRESH_SPEED = require('./config').REFRESH_SPEED
const SCORE_PER_FOOD = require('./config').SCORE_PER_FOOD

class Control {
  constructor(io, map = new Map(defaultMap())) {
    this.players = {}
    this.map = map
    this.x = this.map.x
    this.y = this.map.y
    this.playersNumber = 0;
    this.ticks = 0

    io.on('connection', (socket) => {
      console.log('new user connected')
      socket.emit('init', this.addPlayer(socket))
      socket.on('disconnect', (reason) => {
        console.log('user ' + socket.sessionId + ' disconnected')
        this.onPlayerDisconnect(socket)
      })
      socket.on('playerOperate', (data) => {
        this.onPlayerOperate(socket.sessionId, data.forwards)
      })
    })
    this.refreshFood()
    this.int = setInterval(() => {
      this.loop()
    }, REFRESH_SPEED)
  }

  _buildData() {
    let map = this.map.map
    let players = {}
    for (let i in this.players) {
      players[i] = {
        score: this.players[i].score,
        name: this.players[i].name
      }
      if (this.players[i].died) {
        players[i].died = true
      } else {
        players[i].died = false
        players[i].snake = this.players[i].snake.output()
      }
    }
    return { map, players, ticks: this.ticks }
  }

  addPlayer(socket) {
    socket.sessionId = crypto.createHash('md5').update(Math.random().toString()).digest('hex')
    this.players[socket.sessionId] = { socket }
    let x, y
    do {
      x = parseInt(Math.random() * (this.x - 2) + 1)
      y = parseInt(Math.random() * (this.y - 2) + 1)
    }
    while (this.map.map[x][y].entity)
    this.players[socket.sessionId].snake = new Snake(x, y)
    this.players[socket.sessionId].score = 0
    this.players[socket.sessionId].died = false

    // Random a value to set player's name
    this.players[socket.sessionId].name = NAMES[Math.floor(Math.random() * NAMES.length)]
    this.map.setPoint('snake', x, y)
    let data = this._buildData()
    data.sessionId = socket.sessionId
    data.name = this.players[socket.sessionId].name
    return data
  }

  onPlayerDie(id) {
    if (this.players[id].died) return
    let snake = this.players[id].snake

    // make sure snake's body is distroyed
    // ignore head
    snake.body.forEach(v => {
      this.map.setPoint('air', v.x, v.y)
    }, this)
    this.players[id].snake = null
    this.players[id].died = true
    this.players[id].socket.emit('playerDie')
  }

  onPlayerDisconnect(socket) {
    const id = socket.sessionId
    if (!this.players[id].died) {
      let snake = this.players[id].snake

      // make sure snake's body is distroyed
      // NOT ignore head
      snake.body.forEach(v => {
        this.map.setPoint('air', v.x, v.y)
      }, this)
      this.map.setPoint('air', snake.head.x, snake.head.y)
        // this.players[id].died = true
    }
    delete this.players[id]
  }

  onPlayerOperate(id, forwards) {
    if (!this.players[id] || this.players[id].died) return
    let snake = this.players[id].snake
    snake.isPreparing = false
    switch (forwards) {
    case 'up':
      if (snake.nowFace != 'down') {
        snake.face = 'up'
      }
      break
    case 'down':
      if (snake.nowFace != 'up') {
        snake.face = 'down'
      }
      break
    case 'left':
      if (snake.nowFace != 'right') {
        snake.face = 'left'
      }
      break
    case 'right':
      if (snake.nowFace != 'left') {
        snake.face = 'right'
      }
      break
    }
  }

  broadcastState(state) {
    for (let i in this.players) {
      this.players[i].socket.emit('newState', state)
    }
  }

  refreshFood() {
    let x, y
    do {
      x = parseInt(Math.random() * (this.x - 2) + 1)
      y = parseInt(Math.random() * (this.y - 2) + 1)
    }
    while (this.map.map[x][y].entity)
    this.map.setPoint('food', x, y)
  }

  loop() {
    this.ticks += 1
    let tails = {}
    let heads = {}
    for (let i in this.players) {
      if (this.players[i].died) continue
      tails[i] = this.players[i].snake.move()
      heads[i] = this.players[i].snake.head
    }
    // after moving
    for (let i in this.players) {
      if (this.players[i].died) continue
      let head = heads[i]
      let tail = tails[i]
      if (!this.map.map[head.x][head.y].isReachable && !this.players[i].snake.isPreparing) {
        this.onPlayerDie(i)
      } else if (this.map.map[head.x][head.y].entity == -1) {
        this.players[i].snake.isGrowing += 1
        this.players[i].score += SCORE_PER_FOOD
        this.refreshFood()
      } else {
        this.map.setPoint('snake', head.x, head.y)
      }
      if (tail) {
        this.map.setPoint('air', tail.x, tail.y)
      }
    }
    this.broadcastState(this._buildData())
  }
}

exports = module.exports = { Control }