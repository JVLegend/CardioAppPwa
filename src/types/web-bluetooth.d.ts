// Web Bluetooth API type declarations
interface BluetoothDevice {
  id: string
  name?: string
  gatt?: BluetoothRemoteGATTServer
  addEventListener(type: 'gattserverdisconnected', listener: () => void): void
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: number | string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: number | string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic {
  value: DataView | null
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
}

interface Bluetooth {
  requestDevice(options: {
    filters?: Array<{ services?: number[]; name?: string; namePrefix?: string }>
    optionalServices?: number[]
    acceptAllDevices?: boolean
  }): Promise<BluetoothDevice>
}

interface Navigator {
  bluetooth: Bluetooth
}
