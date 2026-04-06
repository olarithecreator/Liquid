import type { OrderStatus } from '../../types'

type StepState = 'done' | 'active' | 'todo'

type Props = {
  status: OrderStatus
}

function getStepState(status: OrderStatus): [StepState, StepState, StepState, StepState] {
  const step1: StepState = 'done'
  const step2: StepState =
    status === 'proof_uploaded' || status === 'verifying' || status === 'completed'
      ? 'done'
      : 'todo'
  const step3: StepState =
    status === 'verifying' ? 'active' : status === 'completed' ? 'done' : 'todo'
  const step4: StepState = status === 'completed' ? 'done' : 'todo'
  return [step1, step2, step3, step4]
}

function Step({
  label,
  state,
  pulse = false,
}: {
  label: string
  state: StepState
  pulse?: boolean
}) {
  const icon = state === 'done' ? '✓' : state === 'active' ? '⏱' : '○'
  return (
    <div className="ost-step">
      <div className={`ost-dot ${state} ${pulse ? 'pulse' : ''}`.trim()}>{icon}</div>
      <div className={`ost-step-label ${state}`}>{label}</div>
    </div>
  )
}

export default function OrderStepTracker({ status }: Props) {
  const [s1, s2, s3, s4] = getStepState(status)

  return (
    <div className="ost-card">
      <Step label="Order Created" state={s1} />
      <Step label="Payment Proof Uploaded" state={s2} />
      <Step label="Admin Verification" state={s3} pulse={status === 'verifying'} />
      <Step label="Order Complete" state={s4} />
    </div>
  )
}
