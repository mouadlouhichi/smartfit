'use client';

import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Database, Download, Tag, Trash2, UserRound } from 'lucide-react';
import { PLANS } from '@smartfit/core';

export function ProfileScreen() {
  const { state, updateProfile, clearData } = useStore();
  const { openModal } = useModals();

  const counts = {
    workouts: state.sessions.length,
    scheduled: state.schedule.length,
    goals: state.goals.length,
    measurements: state.bodyLogs.length,
  };

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smartfit-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Profile &amp; settings</h1>
        <p className="text-sm text-muted-foreground">Your data stays on this device — no account needed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="h-4 w-4 text-primary" /> You
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input id="p-name" value={state.profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Your name" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-plan">Default strategy</Label>
            <Select value={state.profile.planId} onChange={(e) => updateProfile({ planId: e.target.value as typeof state.profile.planId })}>
              {PLANS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-weight">Weight unit</Label>
            <Select
              id="p-weight"
              value={state.profile.weightUnit}
              onChange={(e) => updateProfile({ weightUnit: e.target.value as 'kg' | 'lb' })}
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-rest">Rest days / week</Label>
            <Select
              id="p-rest"
              value={state.profile.weeklyRestDays}
              onChange={(e) => updateProfile({ weeklyRestDays: Number(e.target.value) })}
            >
              {[0, 1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4 text-primary" /> Your data
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{counts.workouts} workouts</Badge>
            <Badge variant="secondary">{counts.scheduled} scheduled</Badge>
            <Badge variant="secondary">{counts.goals} goals</Badge>
            <Badge variant="secondary">{counts.measurements} measurements</Badge>
            <Badge variant="secondary">{state.categories.length} activity types</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => openModal('category')}>
              <Tag className="h-4 w-4" /> Activity types
            </Button>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm('Erase all your SmartFit data on this device? This cannot be undone.')) clearData();
              }}
            >
              <Trash2 className="h-4 w-4" /> Erase everything
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            SmartFit stores everything locally in your browser (localStorage). Nothing is sent to a server, and there
            are no trackers. Export any time for a backup.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
