import instruments from './instruments.json'

export interface Instrument {
  symbol: string
  tickSize: number
}

export class InstrumentRepository {
  private _lookup: Map<string, Instrument[]> = new Map()

  constructor() {
    for (const exchange of Object.keys(instruments)) {
      const instrumentList: Instrument[] = (instruments as any)[
        exchange
      ] as unknown as Instrument[]
      this._lookup.set(exchange, instrumentList)
    }
  }

  getExchanges(): string[] {
    return [...this._lookup.keys()]
  }

  getExchangeInstruments(exchange: string): Instrument[] {
    return this._lookup.get(exchange)!
  }

  getExchangeInstrument(exchange: string, symbol: string): Instrument {
    const symbols = this.getExchangeInstruments(exchange)
    return symbols.find((ins: Instrument) => ins.symbol === symbol)!
  }
}
