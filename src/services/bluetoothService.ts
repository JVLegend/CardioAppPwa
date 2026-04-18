// Web Bluetooth API for BLE Blood Pressure Monitors
// Service UUID: 0x1810 (Blood Pressure)
// Characteristic UUID: 0x2A35 (Blood Pressure Measurement)

const BP_SERVICE_UUID = 0x1810
const BP_MEASUREMENT_UUID = 0x2a35

export interface BloodPressureReading {
  systolic: number
  diastolic: number
  meanArterialPressure?: number
  pulseRate?: number
  timestamp?: Date
}

export type BLEConnectionState =
  | 'idle'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'error'

export function isWebBluetoothSupported(): boolean {
  return 'bluetooth' in navigator
}

export async function scanAndConnect(
  onReading: (reading: BloodPressureReading) => void,
  onStateChange: (state: BLEConnectionState) => void
): Promise<BluetoothDevice | null> {
  if (!isWebBluetoothSupported()) {
    onStateChange('error')
    return null
  }

  try {
    onStateChange('scanning')
    // TEMP DIAGNOSTIC: accept all devices so we can see Omron proprietary advertisers.
    // Revert to filters:[{services:[BP_SERVICE_UUID]}] after diagnosis.
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [BP_SERVICE_UUID],
    })

    onStateChange('connecting')
    const server = await device.gatt!.connect()
    const service = await server.getPrimaryService(BP_SERVICE_UUID)
    const characteristic = await service.getCharacteristic(BP_MEASUREMENT_UUID)

    characteristic.addEventListener(
      'characteristicvaluechanged',
      (event: Event) => {
        const target = event.target as unknown as BluetoothRemoteGATTCharacteristic
        const value = target.value!
        const reading = parseBPMeasurement(value)
        if (reading) onReading(reading)
      }
    )

    await characteristic.startNotifications()
    onStateChange('connected')

    device.addEventListener('gattserverdisconnected', () => {
      onStateChange('idle')
    })

    return device
  } catch {
    onStateChange('error')
    return null
  }
}

export function disconnect(device: BluetoothDevice | null) {
  if (device?.gatt?.connected) {
    device.gatt.disconnect()
  }
}

function parseBPMeasurement(data: DataView): BloodPressureReading | null {
  try {
    const flags = data.getUint8(0)
    const isKPa = (flags & 0x01) !== 0

    // SFLOAT values at bytes 1-6
    let systolic = parseSFLOAT(data, 1)
    let diastolic = parseSFLOAT(data, 3)
    let map = parseSFLOAT(data, 5)

    // Convert kPa to mmHg if needed
    if (isKPa) {
      systolic *= 7.50062
      diastolic *= 7.50062
      map *= 7.50062
    }

    let offset = 7
    let timestamp: Date | undefined
    let pulseRate: number | undefined

    // Timestamp present
    if ((flags & 0x02) !== 0) {
      const year = data.getUint16(offset, true)
      const month = data.getUint8(offset + 2)
      const day = data.getUint8(offset + 3)
      const hours = data.getUint8(offset + 4)
      const minutes = data.getUint8(offset + 5)
      const seconds = data.getUint8(offset + 6)
      timestamp = new Date(year, month - 1, day, hours, minutes, seconds)
      offset += 7
    }

    // Pulse rate present
    if ((flags & 0x04) !== 0) {
      pulseRate = parseSFLOAT(data, offset)
    }

    return {
      systolic: Math.round(systolic),
      diastolic: Math.round(diastolic),
      meanArterialPressure: Math.round(map),
      pulseRate: pulseRate ? Math.round(pulseRate) : undefined,
      timestamp,
    }
  } catch {
    return null
  }
}

function parseSFLOAT(data: DataView, offset: number): number {
  const raw = data.getUint16(offset, true)
  let mantissa = raw & 0x0fff
  let exponent = (raw >> 12) & 0x0f

  if (exponent >= 8) exponent -= 16
  if (mantissa >= 2048) mantissa -= 4096

  return mantissa * Math.pow(10, exponent)
}

// ---- Mock for testing ----
export function simulateMeasurement(): BloodPressureReading {
  return {
    systolic: 110 + Math.floor(Math.random() * 50),
    diastolic: 65 + Math.floor(Math.random() * 35),
    meanArterialPressure: 80 + Math.floor(Math.random() * 30),
    pulseRate: 55 + Math.floor(Math.random() * 40),
    timestamp: new Date(),
  }
}
