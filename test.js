const test = require('brittle')
const { PassThrough } = require('bare-stream')
const UI = require('.')

test('basic', (t) => {
  t.plan(2)

  const input = new PassThrough()
  const rl = new UI({ input })

  rl
    .on('data', (line) => {
      t.is(line, 'hello world')
      rl.close()
    })
    .on('close', () => {
      t.pass('closed')
    })

  input.write('hello world')
  input.write('\r')
})

test('supports linefeed as line event', (t) => {
  t.plan(2)

  const input = new PassThrough()
  const rl = new UI({ input })

  rl
    .on('line', (line) => {
      t.is(line, 'hello world')
      rl.close()
    })
    .on('close', () => {
      t.pass('closed')
    })

  input.write('hello world')
  input.write('\n')
})

test('supports \\r\\n as single line event', (t) => {
  t.plan(2)

  const input = new PassThrough()
  const rl = new UI({ input })

  rl
    .on('line', (line) => {
      t.is(line, 'hello world')
      rl.close()
    })
    .on('close', () => {
      t.pass('closed')
    })

  input.write('hello world')
  input.write('\r\n')
})