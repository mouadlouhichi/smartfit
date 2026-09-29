'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { DatePicker } from '@/components/ui/date-picker';
import { Heart, Activity, Wind, Droplet, Thermometer, Footprints } from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals, usePayload } from '../modal-context';
import { toISODate } from '@smartfit/core';

export function VitalsModal() {
  const { state, addVitalsLog } = useStore();
  const { closeModal } = useModals();
  const payload = usePayload('vitals');
  const open = payload !== null;

  const [date, setDate] = useState(toISODate(new Date()));
  const [rhr, setRhr] = useState('');
  const [hrv, setHrv] = useState('');
  const [resp, setResp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [temp, setTemp] = useState('');
  const [steps, setSteps] = useState('');
  const [glucose, setGlucose] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(toISODate(new Date()));
    setRhr('');
    setHrv('');
    setResp('');
    setSpo2('');
    setTemp('');
    setSteps('');
    setGlucose('');
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s));
    addVitalsLog({
      date,
      source: 'manual',
      restingHR: num(rhr),
      hrvRmssd: num(hrv),
      respiratoryRate: num(resp),
      spo2: num(spo2),
      skinTempDelta: num(temp),
      steps: num(steps),
      bloodGlucoseMgDl: num(glucose),
    });
    closeModal();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeModal()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <form onSubmit={submit}>
          <DialogHeader>
            <div className="flex items-start gap-3 pr-8">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 shadow-sm"
              >
                <Heart className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle>Log daily vitals</DialogTitle>
                <DialogDescription>
                  Morning measurements give the best recovery signal. All fields optional.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <Field id="v-date" label="Date">
              <DatePicker
                value={date}
                onValueChange={setDate}
                weekStartsOn={state.profile.weekStartsOn ?? 1}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <VitalField
                icon={Heart}
                label="Resting HR"
                unit="bpm"
                placeholder="58"
                value={rhr}
                onChange={setRhr}
                color="#f43f5e"
              />
              <VitalField
                icon={Activity}
                label="HRV (rMSSD)"
                unit="ms"
                placeholder="50"
                value={hrv}
                onChange={setHrv}
                color="var(--volt)"
              />
              <VitalField
                icon={Wind}
                label="Respiratory rate"
                unit="br/min"
                placeholder="15"
                value={resp}
                onChange={setResp}
                color="#38bdf8"
              />
              <VitalField
                icon={Droplet}
                label="Blood oxygen"
                unit="%"
                placeholder="97"
                value={spo2}
                onChange={setSpo2}
                color="#22c55e"
              />
              <VitalField
                icon={Thermometer}
                label="Skin temp Δ"
                unit="°C"
                placeholder="0.0"
                value={temp}
                onChange={setTemp}
                color="#f97316"
              />
              <VitalField
                icon={Footprints}
                label="Steps"
                unit=""
                placeholder="8000"
                value={steps}
                onChange={setSteps}
                color="#a855f7"
              />
            </div>

            <Field id="v-glucose" label="Blood glucose (mg/dL) — optional">
              <Input
                type="number"
                inputMode="decimal"
                placeholder="90"
                value={glucose}
                onChange={(e) => setGlucose(e.target.value)}
              />
            </Field>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit">Save vitals</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VitalField({
  icon: Icon,
  label,
  unit,
  placeholder,
  value,
  onChange,
  color,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  unit: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  color: string;
}) {
  return (
    <Field id={`v-${label}`} label={label}>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
          style={{ color }}
        />
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
        />
        {unit && (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
            {unit}
          </span>
        )}
      </div>
    </Field>
  );
}
