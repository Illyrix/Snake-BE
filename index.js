const fs = require('fs')
const path = require('path')
const Koa = require('koa')
const serve = require("koa-static")
const app = new Koa()
const http = require('http').createServer(app.callback())
const io = require('socket.io')(http)

const { Control } = require('./control')

app.use(serve(path.join(__dirname, "../snake-FE")))

http.listen(3000, '0.0.0.0', () => {
  console.log('listening on *:3000');
  const controller = new Control(io)
})