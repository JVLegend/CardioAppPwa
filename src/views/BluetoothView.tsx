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
    addMeasurement(
      reading.systolic,
      reading.diastolic,
      reading.pulseRate,
      'ble'
    )
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

  const readingClassification = lastReading
    ? classifyBP(lastReading.systolic, lastReading.diastolic)
    : null
  const readingConfig = readingClassification
    ? classificationConfig[readingClassification]
    : null

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Aparelho</h1>

      {!bleSupported && (
        <div className={styles.warning}>
          ⚠️ Web Bluetooth nao e suportado neste navegador. Use Chrome no Android ou computador.
        </div>
      )}

      {/* Connection Status */}
      <div className={styles.statusCard}>
        <div className={styles.statusIcon}>
          {connectionState === 'connected'
            ? '✅'
            : connectionState === 'scanning'
            ? '🔍'
            : connectionState === 'connecting'
            ? '⏳'
            : connectionState === 'error'
            ? '❌'
            : '📱'}
        </div>
        <div>
          <div className={styles.statusLabel}>
            {connectionState === 'connected'
              ? `Conectado: ${device?.name || 'Aparelho'}`
              : connectionState === 'scanning'
              ? 'Buscando aparelhos...'
              : connectionState === 'connecting'
              ? 'Conectando...'
              : connectionState === 'error'
              ? 'Erro na conexao'
              : 'Nenhum aparelho conectado'}
          </div>
        </div>
      </div>

      {/* Actions */}
      {connectionState === 'idle' || connectionState === 'error' ? (
        <button
          className={styles.scanBtn}
          onClick={handleScan}
          disabled={!bleSupported}
        >
          🔍 Buscar Aparelho de Pressao
        </button>
      ) : connectionState === 'scanning' ? (
        <button className={styles.cancelBtn} onClick={handleDisconnect}>
          Cancelar Busca
        </button>
      ) : connectionState === 'connected' ? (
        <div className={styles.connectedActions}>
          <div className={styles.connectedMsg}>
            Aguardando medicao do aparelho...
          </div>
          <button className={styles.cancelBtn} onClick={handleDisconnect}>
            Desconectar
          </button>
        </div>
      ) : null}

      {/* Last BLE Reading */}
      {lastReading && readingConfig && (
        <div className={styles.readingCard} style={{ borderColor: readingConfig.color }}>
          <h3 className={styles.readingTitle}>Ultima Leitura BLE</h3>
          <div className={styles.readingValues}>
            <span style={{ color: readingConfig.color, fontSize: 40, fontWeight: 700 }}>
              {lastReading.systolic}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 24 }}>/</span>
            <span style={{ fontSize: 28, fontWeight: 600 }}>
              {lastReading.diastolic}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}>mmHg</span>
          </div>
          <div style={{ color: readingConfig.color, fontSize: 14 }}>
            {readingConfig.emoji} {readingConfig.label}
          </div>
          {lastReading.pulseRate && (
            <div className={styles.readingHR}>❤️ {lastReading.pulseRate} bpm</div>
          )}
        </div>
      )}

      {/* Saved Devices */}
      {savedDevices.length > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Aparelhos Salvos</h2>
          {savedDevices.map((d) => (
            <div key={d.id} className={styles.deviceItem}>
              <span className={styles.deviceIcon}>📱</span>
              <div>
                <div className={styles.deviceName}>{d.model}</div>
                {d.lastConnectedAt && (
                  <div className={styles.deviceDate}>
                    Ultimo uso: {new Date(d.lastConnectedAt).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Simulate for testing */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Teste / Simulacao</h2>
        <button className={styles.simulateBtn} onClick={handleSimulate}>
          🧪 Simular Medicao
        </button>
      </div>
    </div>
  )
}
