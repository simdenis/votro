import { formatDateShort } from '@/lib/utils'
import type { LawStatus, PresidentialStatus, CcrDecision } from '@/lib/types'

type Step = {
  label: string
  date: string | null
  status: 'done' | 'failed' | 'partial' | 'pending' | 'waiting'
  detail?: string
}

function presidentialLabel(s: PresidentialStatus): string {
  if (s === 'promulgat')   return 'Promulgată'
  if (s === 'retrimis')    return 'Retrimisă la Parlament'
  return 'Sesizată la CCR'
}

function ccrLabel(d: CcrDecision): string {
  if (d === 'constitutional')          return 'Constituțională'
  if (d === 'neconstitutional')        return 'Neconstituțională'
  return 'Parțial neconstituțională'
}

function stepColor(s: Step['status']): string {
  if (s === 'done')    return 'bg-adoptat text-white border-adoptat'
  if (s === 'failed')  return 'bg-respins text-white border-respins'
  if (s === 'partial') return 'bg-amber-500 text-white border-amber-500'
  if (s === 'pending') return 'bg-surface border-foreground/40 text-foreground'
  return 'bg-raised border-rim text-faint'
}

function lineColor(s: Step['status']): string {
  if (s === 'waiting') return 'bg-rim'
  if (s === 'failed')  return 'bg-respins/40'
  return 'bg-adoptat/40'
}

export function LawTimeline({ law }: { law: LawStatus }) {
  const senateFirst =
    !law.senate_vote_date ||
    !law.camera_vote_date ||
    law.senate_vote_date <= law.camera_vote_date

  // A promulgated / forwarded / CCR-referred law passed both chambers, even if
  // we have no plenary vote for one of them (tacit adoption or unscraped vote).
  const passed = !!law.presidential_status

  const steps: Step[] = []

  // First chamber
  const firstChamber = senateFirst
    ? { label: 'Senat', date: law.senate_vote_date, outcome: law.senate_outcome }
    : { label: 'Camera Deputaților', date: law.camera_vote_date, outcome: law.camera_outcome }

  const secondChamber = senateFirst
    ? { label: 'Camera Deputaților', date: law.camera_vote_date, outcome: law.camera_outcome }
    : { label: 'Senat', date: law.senate_vote_date, outcome: law.senate_outcome }

  steps.push({
    label: firstChamber.label,
    date: firstChamber.date,
    status: !firstChamber.date
      ? (passed ? 'done' : 'waiting')
      : firstChamber.outcome === 'adoptat' ? 'done'
      : firstChamber.outcome === 'respins' ? 'failed'
      : 'pending',
    detail: firstChamber.outcome ?? (!firstChamber.date && passed ? 'fără vot în plen' : undefined),
  })

  steps.push({
    label: secondChamber.label,
    date: secondChamber.date,
    status: !secondChamber.date
      ? (passed ? 'done' : 'waiting')
      : secondChamber.outcome === 'adoptat' ? 'done'
      : secondChamber.outcome === 'respins' ? 'failed'
      : 'pending',
    detail: secondChamber.outcome ?? (!secondChamber.date && passed ? 'fără vot în plen' : undefined),
  })

  // CCR (only if referred)
  if (law.ccr_decision || law.presidential_status === 'sesizat_ccr') {
    steps.push({
      label: 'Curtea Constituțională',
      date: law.ccr_date,
      status: !law.ccr_decision
        ? 'pending'
        : law.ccr_decision === 'constitutional' ? 'done'
        : law.ccr_decision === 'neconstitutional' ? 'failed'
        : 'partial',
      detail: law.ccr_decision ? ccrLabel(law.ccr_decision) : 'În așteptare',
    })
  }

  // Presidential step
  const presidentialStep: Step = {
    label: 'Președinte',
    date: law.presidential_date,
    status: !law.presidential_status
      ? 'waiting'
      : law.presidential_status === 'promulgat' ? 'done'
      : law.presidential_status === 'retrimis' ? 'failed'
      : 'pending',
    detail: law.presidential_status ? presidentialLabel(law.presidential_status) : undefined,
  }
  steps.push(presidentialStep)

  return (
    <div>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-5">
        Parcurs legislativ
      </h2>
      <div className="flex items-start gap-0">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-start flex-1 min-w-0">
            {/* Step + label */}
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${stepColor(step.status)}`}>
                {step.status === 'done'    ? '✓'
               : step.status === 'failed'  ? '✗'
               : step.status === 'partial' ? '!'
               : step.status === 'pending' ? '…'
               : String(i + 1)}
              </div>
              <div className="mt-2 text-center px-1">
                <div className={`text-[11px] font-semibold leading-tight ${step.status === 'waiting' ? 'text-faint' : 'text-foreground'}`}>
                  {step.label}
                </div>
                {step.detail && (
                  <div className={`text-[10px] mt-0.5 leading-tight ${
                    step.status === 'done'    ? 'text-adoptat'
                  : step.status === 'failed'  ? 'text-respins'
                  : step.status === 'partial' ? 'text-amber-500'
                  : 'text-muted'
                  }`}>
                    {step.detail}
                  </div>
                )}
                {step.date && (
                  <div className="text-[10px] text-faint mt-0.5">{formatDateShort(step.date)}</div>
                )}
              </div>
            </div>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mt-4 mx-1 shrink ${lineColor(steps[i + 1].status)}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
