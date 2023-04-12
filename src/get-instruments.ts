/**
 * Use this script to load the lastest instruments from the exchanges.
 * We only load instruments such as spot and perpetuals and not futures, so
 * as to keep it (vaguely) up to date. Ideally this should be done dynamically
 * but due to certain exchanges having certain CORS rules we can't do this easily.
 */

import { Instrument } from './instruments'
import * as fs from 'fs'

type InstrumentFile = { [key: string]: Instrument[] }

async function getBitMEX(): Promise<Instrument[]> {
  console.log('Fetching BitMEX instruments...')
  const response = await fetch(
    'https://www.bitmex.com/api/v1/instrument/active'
  )
  const json = await response.json()
  const instruments: Instrument[] = []
  for (const x of json) {
    if (!['FFWCSX', 'FFWCSF', 'IFXXXP'].includes(x.typ)) continue
    const tickSize = x.tickSize
    const symbol = x.symbol
    const instrument: Instrument = { symbol, tickSize }
    instruments.push(instrument)
  }
  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol))
  console.log(`Got ${instruments.length}`)
  return instruments
}

async function getBinance(): Promise<Instrument[]> {
  console.log('Fetching Binance instruments...')
  const response = await fetch('https://api.binance.com/api/v1/exchangeInfo')
  const json = await response.json()
  const instruments: Instrument[] = []
  for (const x of json.symbols) {
    if (x.status !== 'TRADING') continue
    const tickSize = parseFloat(x.filters[0].tickSize)
    const symbol = x.symbol
    const instrument: Instrument = { symbol, tickSize }
    instruments.push(instrument)
  }
  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol))
  console.log(`Got ${instruments.length}`)
  return instruments
}

async function getKraken(): Promise<Instrument[]> {
  console.log('Fetching Kraken instruments...')
  const response = await fetch('https://api.kraken.com/0/public/AssetPairs')
  const json = await response.json()
  const instruments: Instrument[] = []
  for (const x in json.result) {
    if (json.result[x].wsname === undefined) continue
    if (json.result[x].status !== 'online') continue
    const tickSize = parseFloat(json.result[x].tick_size)
    const symbol = json.result[x].wsname
    const instrument: Instrument = { symbol, tickSize }
    instruments.push(instrument)
  }
  instruments.sort((a, b) => a.symbol.localeCompare(b.symbol))
  console.log(`Got ${instruments.length}`)
  return instruments
}

async function main() {
  const file: InstrumentFile = {}
  file['BitMEX'] = await getBitMEX()
  file['Binance'] = await getBinance()
  file['Kraken'] = await getKraken()

  fs.writeFileSync('src/instruments.json', JSON.stringify(file, null, 2))
}

main()
