import { useState, useEffect } from 'react'
import {
  isWebBluetoothSupported,
  scanAndConnect,
  disconnect,
  simulateMeasurement,
  type BloodPressureReading,
  type BLEConnectionState,
} from '../services/bluetoothService'
import { usePatientData } from '../hooks/usePatientData'
import { classifyBP, classificationConfig } from '../config/theme'
import * as db from '../services/database'
import { useAuth } from '../contexts/AuthContext'
import styles from './BluetoothView.module.css'

export default function BluetoothView() {
  const { addMeasurement } = usePatientData()
  const { currentPatient } = useAuth()
  const [connectionState, setConnectionState] = useState<BLEConnectionState>('idle')
  const [device, setDevice] = useState<BluetoothDevice | null>(null)
  const [lastReading, setLastReading] = useState<BloodPressureReading | null>(null)
  const [savedDevices, setSavedDevices] = useState<{ id: string; model: string; lastConnectedAt?: string }[]>([])
  const bleSupported = isWebBluetoothSupported()

  useEffect(() => {
    if (currentPatient) {
      db.fetchDevices(currentPatient.id).then(setSavedDevices)
    }
  }, [currentPatient])

  const handleReading = (reading: BloodPressureReading) => {
    setLastReading(reading)
    addMeasurement(reading.systolic, reading.diastolic, reading.pulseRate, 'ble')
  }

  const handleScan = async () => {
    const d = await scanAndConnect(handleReading, setConnectionState)
    if (d) {
      setDevice(d)
      if (currentPatient) {
        const dev = {
          id: d.id || crypto.randomUUID(),
          patientId: currentPatient.id,
          model: d.name || 'Aparelho BLE',
          lastConnectedAt: new Date().toISOString(),
        }
        await db.saveDevice(dev)
        setSavedDevices((prev) => {
          const exists = prev.some((p) => p.id === dev.id)
          if (exists) return prev.map((p) => (p.id === dev.id ? dev : p))
          return [...prev, dev]
        })
      }
    }
  }

  const handleDisconnect = () => {
    disconnect(device)
    setDevice(null)
    setConnectionState('idle')
  }

  const handleSimulate = () => {
    const reading = simulateMeasurement()
    handleReading(reading)
    setLastReading(reading)
  }

  const readingClass = lastReading ? classifyBP(lastReading.systolic, lastReading.diastolic) : null
  const readingConfig = readingClass ? classificationConfig[readingClass] : null

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Aparelho</h1>

      {!bleSupported && (
        <div className={styles.infoCard}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-orange)" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <div className={styles.infoTitle}>Bluetooth nao disponivel</div>
            <div className={styles.infoDesc}>
              Web Bluetooth nao e suportado neste navegador. No iPhone, use o registro manual. No Android, use o Chrome.
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className={styles.statusCard}>
        <div className={styles.statusIndicator} style={{
          background: connectionState === 'connected' ? 'var(--cardio-green)'
            : connectionState === 'error' ? 'var(--cardio-red)'
            : 'var(--text-muted)',
        }} />
        <div className={styles.statusText}>
          {connectionState === 'connected' ? `Conectado: ${device?.name || 'Aparelho'}`
            : connectionState === 'scanning' ? 'Buscando aparelhos...'
            : connectionState === 'connecting' ? 'Conectando...'
            : connectionState === 'error' ? 'Erro na conexao'
            : 'Nenhum aparelho conectado'}
        </div>
      </div>

      {/* Actions */}
      {connectionState === 'idle' || connectionState === 'error' ? (
        <button className={styles.scanBtn} onClick={handleScan} disabled={!bleSupported}>
          Buscar Aparelho
        </button>
      ) : connectionState === 'scanning' || connectionState === 'connecting' ? (
        <button className={styles.secondaryBtn} onClick={handleDisconnect}>
          Cancelar
        </button>
      ) : connectionState === 'connected' ? (
        <>
          <div className={styles.waitingMsg}>Aguardando medicao do aparelho...</div>
          <button className={styles.secondaryBtn} onClick={handleDisconnect}>
            Desconectar
          </button>
        </>
      ) : null}

      {/* Last Reading */}
      {lastReading && readingConfig && (
        <div className={styles.readingCard}>
          <span className={styles.readingLabel}>Ultima leitura</span>
          <div className={styles.readingValues}>
            <span className={styles.readingSys} style={{ color: readingConfig.color }}>
              {lastReading.systolic}
            </span>
            <span className={styles.readingSlash}>/</span>
            <span className={styles.readingDia}>{lastReading.diastolic}</span>
            <span className={styles.readingUnit}>mmHg</span>
          </div>
          <div className={styles.readingClass}>
            <span className={styles.readingDot} style={{ background: readingConfig.color }} />
            <span style={{ color: readingConfig.color }}>{readingConfig.label}</span>
          </div>
          {lastReading.pulseRate && (
            <div className={styles.readingHR}>{lastReading.pulseRate} bpm</div>
          )}
        </div>
      )}

      {/* Saved Devices */}
      {savedDevices.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Aparelhos salvos</h2>
          <div className={styles.deviceList}>
            {savedDevices.map((d, i) => (
              <div key={d.id} className={styles.deviceItem} style={{ animationDelay: `${i * 0.05}s` }}>
                <div className={styles.deviceIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--cardio-blue)" strokeWidth="2">
                    <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"/>
                  </svg>
                </div>
                <div className={styles.deviceInfo}>
                  <div className={styles.deviceName}>{d.model}</div>
                  {d.lastConnectedAt && (
                    <div className={styles.deviceDate}>
                      {new Date(d.lastConnectedAt).toLocaleDateString('pt-BR')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulate */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Teste</h2>
        <button className={styles.simulateBtn} onClick={handleSimulate}>
          Simular medicao
        </button>
      </div>
    </div>
  )
}
