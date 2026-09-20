'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  MapPin,
  Clock,
  Sparkles,
  Dumbbell,
  Users,
  Edit3,
  Check,
  X,
  Zap,
  Target,
  Flame,
  Brain,
} from 'lucide-react';
import { useStore } from '@/lib/store-context';
import { useModals } from '../modal-context';
import { useConfirm } from '../confirm-context';
import { useToast } from '@/components/ui/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  type CustomGym,
  type CustomGymProgram,
  type CustomGymClass,
  getAllGyms,
  createCustomGym,
  createGymProgram,
  createGymClass,
  aiAnalyzeClass,
  type ClassFocus,
} from '@smartfit/core';
import type { Intensity } from '@smartfit/core';

const FOCUS_OPTIONS: { value: ClassFocus; label: string; icon: string; color: string }[] = [
  { value: 'strength', label: 'Strength', icon: '💪', color: '#ff6b35' },
  { value: 'cardio', label: 'Cardio', icon: '🏃', color: '#00d4aa' },
  { value: 'hiit', label: 'HIIT', icon: '⚡', color: '#ffd23f' },
  { value: 'combat', label: 'Combat', icon: '🥊', color: '#ff2e63' },
  { value: 'mind', label: 'Mind & Recovery', icon: '🧘', color: '#8b5cf6' },
  { value: 'aqua', label: 'Aqua', icon: '🏊', color: '#06b6d4' },
];

const INTENSITY_OPTIONS: { value: Intensity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#22c55e' },
  { value: 'moderate', label: 'Moderate', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
];

export function GymManagement() {
  const { state, updateState } = useStore();
  const confirm = useConfirm();
  const toast = useToast();
  const { openWith } = useModals();

  const [showAddGym, setShowAddGym] = useState(false);
  const [editingGym, setEditingGym] = useState<CustomGym | null>(null);
  const [selectedGym, setSelectedGym] = useState<string | null>(state.profile.gymId || null);
  const [showAddProgram, setShowAddProgram] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<string | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);

  // Form states
  const [gymForm, setGymForm] = useState({ name: '', location: '', hours: '', description: '' });
  const [programForm, setProgramForm] = useState({
    name: '',
    description: '',
    focus: 'strength' as ClassFocus,
    intensity: 'moderate' as Intensity,
    durationMin: 45,
  });
  const [classForm, setClassForm] = useState({
    name: '',
    focus: 'strength' as ClassFocus,
    intensity: 'moderate' as Intensity,
    minutes: 45,
    weekday: 1,
    time: '18:00',
    instructor: '',
  });

  const allGyms = useMemo(() => getAllGyms(state.customGyms || []), [state.customGyms]);
  const currentGym = useMemo(
    () => allGyms.find((g) => g.id === selectedGym) || null,
    [allGyms, selectedGym],
  );
  const currentProgram = useMemo(
    () => currentGym?.programs.find((p) => p.id === selectedProgram) || null,
    [currentGym, selectedProgram],
  );

  // ── Gym CRUD ──────────────────────────────────────────────────────────

  const handleAddGym = () => {
    if (!gymForm.name.trim()) {
      toast('Gym name is required');
      return;
    }
    const newGym = createCustomGym(gymForm);
    const updated = [...(state.customGyms || []), newGym];
    updateState({ customGyms: updated });
    setGymForm({ name: '', location: '', hours: '', description: '' });
    setShowAddGym(false);
    setSelectedGym(newGym.id);
    toast(`Gym "${newGym.name}" added!`);
  };

  const handleDeleteGym = async (gym: CustomGym) => {
    if (!gym.custom) {
      toast('Cannot delete built-in gyms');
      return;
    }
    const ok = await confirm({
      title: `Delete "${gym.name}"?`,
      body: `This will delete the gym and all its ${gym.programs.length} programs. This cannot be undone.`,
      confirmLabel: 'Delete gym',
      destructive: true,
    });
    if (!ok) return;

    const updated = (state.customGyms || []).filter((g) => g.id !== gym.id);
    updateState({ customGyms: updated });

    if (selectedGym === gym.id) {
      setSelectedGym(allGyms.find((g) => g.id !== gym.id)?.id || null);
    }
    if (state.profile.gymId === gym.id) {
      updateState({ profile: { ...state.profile, gymId: undefined } });
    }
    toast(`Gym "${gym.name}" deleted`);
  };

  const handleSelectGym = (gymId: string) => {
    setSelectedGym(gymId);
    updateState({ profile: { ...state.profile, gymId } });
    toast(`Selected ${allGyms.find((g) => g.id === gymId)?.name}`);
  };

  // ── Program CRUD ──────────────────────────────────────────────────────

  const handleAddProgram = () => {
    if (!currentGym || !programForm.name.trim()) {
      toast('Program name required');
      return;
    }
    const newProg = createGymProgram({
      gymId: currentGym.id,
      ...programForm,
    });

    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id ? { ...g, programs: [...g.programs, newProg] } : g,
    );

    // Handle built-in gyms - convert to custom copy
    if (!currentGym.custom) {
      const customCopy: CustomGym = {
        ...currentGym,
        custom: true,
        programs: [...currentGym.programs, newProg],
        id: currentGym.id,
      };
      const existing = (state.customGyms || []).find((g) => g.id === currentGym.id);
      if (existing) {
        // Update existing custom copy
        const final = (state.customGyms || []).map((g) =>
          g.id === currentGym.id ? customCopy : g,
        );
        updateState({ customGyms: final });
      } else {
        updateState({ customGyms: [...(state.customGyms || []), customCopy] });
      }
    } else {
      updateState({ customGyms: updatedGyms });
    }

    setProgramForm({
      name: '',
      description: '',
      focus: 'strength',
      intensity: 'moderate',
      durationMin: 45,
    });
    setShowAddProgram(false);
    setSelectedProgram(newProg.id);
    toast(`Program "${newProg.name}" created!`);
  };

  const handleDeleteProgram = async (prog: CustomGymProgram) => {
    if (!currentGym) return;
    const ok = await confirm({
      title: `Delete "${prog.name}"?`,
      body: `This will delete the program and its ${prog.classes.length} classes.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id ? { ...g, programs: g.programs.filter((p) => p.id !== prog.id) } : g,
    );
    updateState({ customGyms: updatedGyms });
    if (selectedProgram === prog.id) setSelectedProgram(null);
    toast(`Program deleted`);
  };

  const toggleProgramEnroll = (prog: CustomGymProgram) => {
    if (!currentGym) return;
    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id
        ? {
            ...g,
            programs: g.programs.map((p) =>
              p.id === prog.id ? { ...p, enrolled: !p.enrolled } : p,
            ),
          }
        : g,
    );
    updateState({ customGyms: updatedGyms });
    toast(prog.enrolled ? `Left ${prog.name}` : `Joined ${prog.name}! 🎉`);
  };

  // ── Class CRUD ────────────────────────────────────────────────────────

  const handleAddClass = () => {
    if (!currentGym || !currentProgram || !classForm.name.trim()) {
      toast('Class name required');
      return;
    }
    const newClass = createGymClass({
      programId: currentProgram.id,
      ...classForm,
    });

    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id
        ? {
            ...g,
            programs: g.programs.map((p) =>
              p.id === currentProgram.id ? { ...p, classes: [...p.classes, newClass] } : p,
            ),
          }
        : g,
    );
    updateState({ customGyms: updatedGyms });
    setClassForm({
      name: '',
      focus: 'strength',
      intensity: 'moderate',
      minutes: 45,
      weekday: 1,
      time: '18:00',
      instructor: '',
    });
    setShowAddClass(false);
    toast(`Class "${newClass.name}" added with AI exercises! 🤖`);
  };

  const handleDeleteClass = async (cls: CustomGymClass) => {
    if (!currentGym || !currentProgram) return;
    const ok = await confirm({
      title: `Delete "${cls.name}"?`,
      body: 'This class will be removed from the program.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id
        ? {
            ...g,
            programs: g.programs.map((p) =>
              p.id === currentProgram.id
                ? { ...p, classes: p.classes.filter((c) => c.id !== cls.id) }
                : p,
            ),
          }
        : g,
    );
    updateState({ customGyms: updatedGyms });
    toast('Class deleted');
  };

  const toggleClassEnroll = (cls: CustomGymClass) => {
    if (!currentGym || !currentProgram) return;
    const updatedGyms = (state.customGyms || []).map((g) =>
      g.id === currentGym.id
        ? {
            ...g,
            programs: g.programs.map((p) =>
              p.id === currentProgram.id
                ? {
                    ...p,
                    classes: p.classes.map((c) =>
                      c.id === cls.id ? { ...c, enrolled: !c.enrolled } : c,
                    ),
                  }
                : p,
            ),
          }
        : g,
    );
    updateState({ customGyms: updatedGyms });

    if (!cls.enrolled) {
      // Auto-start workout with AI exercises
      const analysis = aiAnalyzeClass(cls.name, cls.focus, cls.intensity);
      openWith({
        kind: 'runner',
        title: cls.name,
        categoryId: `cat-${cls.focus === 'strength' ? 'strength' : cls.focus === 'cardio' ? 'cardio' : 'hiit'}`,
        intensity: cls.intensity,
        exercises: analysis.exercises,
      });
    }

    toast(cls.enrolled ? `Left ${cls.name}` : `Joined ${cls.name}! Starting workout...`);
  };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="bg-volt text-ink grid h-9 w-9 place-items-center rounded-xl">
              <Building2 className="h-5 w-5" />
            </span>
            My Gyms
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Add your gyms, create programs, join courses. AI builds your workouts.
          </p>
        </div>
        <Button onClick={() => setShowAddGym(true)} className="rounded-full">
          <Plus className="h-4 w-4" /> Add my gym
        </Button>
      </div>

      {/* Gym Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {allGyms.map((gym) => {
          const isSelected = selectedGym === gym.id;
          return (
            <Card
              key={gym.id}
              className={cn(
                'group relative overflow-hidden transition-all hover:shadow-lg',
                isSelected ? 'border-volt bg-volt/5 ring-volt/20 ring-1' : 'hover:border-volt/30',
              )}
            >
              {isSelected && (
                <div className="bg-volt absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full">
                  <Check className="h-3.5 w-3.5 text-black" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">{gym.name}</h3>
                    {gym.location && (
                      <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3" /> {gym.location}
                      </p>
                    )}
                    {gym.hours && (
                      <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" /> {gym.hours}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[11px]">
                        {gym.programs.length} programs
                      </Badge>
                      <Badge variant="outline" className="text-[11px]">
                        {gym.programs.reduce((a, p) => a + p.classes.length, 0)} classes
                      </Badge>
                      {!gym.custom && (
                        <Badge className="bg-volt text-ink text-[11px]">Built-in</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    className="flex-1 rounded-full"
                    onClick={() => handleSelectGym(gym.id)}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                  {gym.custom ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteGym(gym)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedGym(gym.id)}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Gym Form */}
      {showAddGym && (
        <Card className="border-volt/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> Add my gym
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field id="gym-name" label="Gym name *">
              <Input
                value={gymForm.name}
                onChange={(e) => setGymForm({ ...gymForm, name: e.target.value })}
                placeholder="e.g. My Fitness Zone"
              />
            </Field>
            <Field id="gym-location" label="Location">
              <Input
                value={gymForm.location}
                onChange={(e) => setGymForm({ ...gymForm, location: e.target.value })}
                placeholder="e.g. Casablanca Marina"
              />
            </Field>
            <Field id="gym-hours" label="Hours">
              <Input
                value={gymForm.hours}
                onChange={(e) => setGymForm({ ...gymForm, hours: e.target.value })}
                placeholder="e.g. Mon-Fri 6am-10pm"
              />
            </Field>
            <Field id="gym-desc" label="Description">
              <Input
                value={gymForm.description}
                onChange={(e) => setGymForm({ ...gymForm, description: e.target.value })}
                placeholder="What makes this gym special?"
              />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button onClick={handleAddGym} className="rounded-full">
                <Plus className="h-4 w-4" /> Create gym
              </Button>
              <Button variant="ghost" onClick={() => setShowAddGym(false)} className="rounded-full">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Gym Detail */}
      {currentGym && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <span className="bg-primary/10 text-primary grid h-9 w-9 place-items-center rounded-xl">
                  <Building2 className="h-5 w-5" />
                </span>
                {currentGym.name} Programs
                <Badge variant="accent">{currentGym.programs.length}</Badge>
              </CardTitle>
              <Button size="sm" onClick={() => setShowAddProgram(true)} className="rounded-full">
                <Plus className="h-4 w-4" /> Add program
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {/* Programs List */}
            {currentGym.programs.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <Dumbbell className="text-muted-foreground mx-auto h-8 w-8" />
                <p className="mt-2 text-sm font-semibold">No programs yet</p>
                <p className="text-muted-foreground text-xs">
                  Create your first program to organize classes
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {currentGym.programs.map((prog) => {
                  const isSelected = selectedProgram === prog.id;
                  const focusOpt = FOCUS_OPTIONS.find((f) => f.value === prog.focus);
                  return (
                    <div
                      key={prog.id}
                      className={cn(
                        'rounded-2xl border p-4 transition-all',
                        isSelected ? 'border-volt bg-volt/5' : 'hover:border-volt/30 bg-card',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold">{prog.name}</h4>
                            <Badge
                              variant="secondary"
                              style={{
                                backgroundColor: `${focusOpt?.color}15`,
                                color: focusOpt?.color,
                                borderColor: `${focusOpt?.color}30`,
                              }}
                            >
                              {focusOpt?.icon} {focusOpt?.label}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {prog.intensity}
                            </Badge>
                            {prog.enrolled && <Badge className="bg-volt text-ink">Enrolled</Badge>}
                          </div>
                          {prog.description && (
                            <p className="text-muted-foreground mt-1 text-xs">{prog.description}</p>
                          )}
                          <p className="text-muted-foreground mt-1 text-xs">
                            {prog.classes.length} classes · {prog.durationMin} min avg
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant={prog.enrolled ? 'default' : 'outline'}
                            className="rounded-full"
                            onClick={() => toggleProgramEnroll(prog)}
                          >
                            {prog.enrolled ? (
                              <>
                                <Check className="h-3.5 w-3.5" /> Joined
                              </>
                            ) : (
                              <>
                                <Users className="h-3.5 w-3.5" /> Join
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedProgram(isSelected ? null : prog.id)}
                            className="rounded-full"
                          >
                            {isSelected ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => handleDeleteProgram(prog)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Classes inside program */}
                      {isSelected && (
                        <div className="mt-4 grid gap-3 border-t pt-4">
                          <div className="flex items-center justify-between">
                            <h5 className="flex items-center gap-2 text-sm font-bold">
                              <Zap className="h-4 w-4" /> Classes & Courses
                            </h5>
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => setShowAddClass(true)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Add class
                            </Button>
                          </div>

                          {prog.classes.length === 0 ? (
                            <p className="text-muted-foreground bg-secondary/50 rounded-xl p-4 text-center text-xs">
                              No classes yet. Add a class and AI will auto-generate exercises!
                            </p>
                          ) : (
                            <div className="grid gap-2">
                              {prog.classes.map((cls) => {
                                const analysis = aiAnalyzeClass(cls.name, cls.focus, cls.intensity);
                                return (
                                  <div
                                    key={cls.id}
                                    className="group bg-secondary/30 hover:bg-secondary/60 flex items-center gap-3 rounded-xl border p-3 transition-colors"
                                  >
                                    <span
                                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm"
                                      style={{
                                        backgroundColor: `${FOCUS_OPTIONS.find((f) => f.value === cls.focus)?.color}15`,
                                        color: FOCUS_OPTIONS.find((f) => f.value === cls.focus)
                                          ?.color,
                                      }}
                                    >
                                      {FOCUS_OPTIONS.find((f) => f.value === cls.focus)?.icon}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">{cls.name}</p>
                                      <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
                                        <span>{cls.minutes} min</span>
                                        {cls.time && (
                                          <>
                                            <span>·</span>
                                            <span>{cls.time}</span>
                                          </>
                                        )}
                                        {cls.instructor && (
                                          <>
                                            <span>·</span>
                                            <span>{cls.instructor}</span>
                                          </>
                                        )}
                                        <span>·</span>
                                        <span className="flex items-center gap-1">
                                          <Brain className="h-3 w-3" /> {analysis.exercises.length}{' '}
                                          AI exercises
                                        </span>
                                      </p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {analysis.muscles.slice(0, 3).map((m) => (
                                          <Badge key={m} variant="outline" className="text-[10px]">
                                            {m}
                                          </Badge>
                                        ))}
                                        {analysis.muscles.length > 3 && (
                                          <Badge variant="outline" className="text-[10px]">
                                            +{analysis.muscles.length - 3}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 flex-col gap-1">
                                      <Button
                                        size="sm"
                                        variant={cls.enrolled ? 'default' : 'outline'}
                                        className="rounded-full"
                                        onClick={() => toggleClassEnroll(cls)}
                                      >
                                        {cls.enrolled ? (
                                          <>
                                            <Check className="h-3 w-3" /> Enrolled
                                          </>
                                        ) : (
                                          <>
                                            <Target className="h-3 w-3" /> Join
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive h-7"
                                        onClick={() => handleDeleteClass(cls)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Add Class Form */}
                          {showAddClass && (
                            <div className="bg-card rounded-2xl border p-4">
                              <h6 className="mb-3 flex items-center gap-2 text-sm font-bold">
                                <Sparkles className="h-4 w-4" /> Add new class - AI will generate
                                exercises
                              </h6>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field id="class-name" label="Class name *">
                                  <Input
                                    value={classForm.name}
                                    onChange={(e) =>
                                      setClassForm({ ...classForm, name: e.target.value })
                                    }
                                    placeholder="e.g. Spinning, Tabata, Power Pump"
                                  />
                                </Field>
                                <Field id="class-instructor" label="Instructor">
                                  <Input
                                    value={classForm.instructor}
                                    onChange={(e) =>
                                      setClassForm({ ...classForm, instructor: e.target.value })
                                    }
                                    placeholder="e.g. Coach Alex"
                                  />
                                </Field>
                                <Field id="class-focus" label="Focus">
                                  <Select
                                    value={classForm.focus}
                                    onChange={(e) =>
                                      setClassForm({
                                        ...classForm,
                                        focus: e.target.value as ClassFocus,
                                      })
                                    }
                                  >
                                    {FOCUS_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.icon} {o.label}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field id="class-intensity" label="Intensity">
                                  <Select
                                    value={classForm.intensity}
                                    onChange={(e) =>
                                      setClassForm({
                                        ...classForm,
                                        intensity: e.target.value as Intensity,
                                      })
                                    }
                                  >
                                    {INTENSITY_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label}
                                      </option>
                                    ))}
                                  </Select>
                                </Field>
                                <Field id="class-minutes" label="Duration (min)">
                                  <Input
                                    type="number"
                                    value={classForm.minutes}
                                    onChange={(e) =>
                                      setClassForm({
                                        ...classForm,
                                        minutes: Number(e.target.value),
                                      })
                                    }
                                  />
                                </Field>
                                <Field id="class-time" label="Time">
                                  <Input
                                    type="time"
                                    value={classForm.time}
                                    onChange={(e) =>
                                      setClassForm({ ...classForm, time: e.target.value })
                                    }
                                  />
                                </Field>
                                <Field id="class-weekday" label="Day">
                                  <Select
                                    value={classForm.weekday}
                                    onChange={(e) =>
                                      setClassForm({
                                        ...classForm,
                                        weekday: Number(e.target.value),
                                      })
                                    }
                                  >
                                    <option value={0}>Sunday</option>
                                    <option value={1}>Monday</option>
                                    <option value={2}>Tuesday</option>
                                    <option value={3}>Wednesday</option>
                                    <option value={4}>Thursday</option>
                                    <option value={5}>Friday</option>
                                    <option value={6}>Saturday</option>
                                  </Select>
                                </Field>
                                {classForm.name && (
                                  <div className="sm:col-span-2">
                                    <div className="bg-volt/10 border-volt/20 rounded-xl border p-3">
                                      <p className="flex items-center gap-1.5 text-xs font-bold">
                                        <Brain className="h-3.5 w-3.5" /> AI Preview:
                                      </p>
                                      <p className="text-muted-foreground mt-1 text-xs">
                                        {
                                          aiAnalyzeClass(
                                            classForm.name,
                                            classForm.focus,
                                            classForm.intensity,
                                          ).exercises.length
                                        }{' '}
                                        exercises will be auto-generated for &quot;{classForm.name}
                                        &quot; - muscles:{' '}
                                        {aiAnalyzeClass(
                                          classForm.name,
                                          classForm.focus,
                                          classForm.intensity,
                                        ).muscles.join(', ')}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex gap-2 sm:col-span-2">
                                  <Button onClick={handleAddClass} className="rounded-full">
                                    <Plus className="h-4 w-4" /> Add class
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => setShowAddClass(false)}
                                    className="rounded-full"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Program Form */}
            {showAddProgram && (
              <div className="bg-card rounded-2xl border p-4">
                <h5 className="mb-3 font-bold">Add new program</h5>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field id="prog-name" label="Program name *">
                    <Input
                      value={programForm.name}
                      onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
                      placeholder="e.g. Summer Shred, Strength Builder"
                    />
                  </Field>
                  <Field id="prog-focus" label="Focus">
                    <Select
                      value={programForm.focus}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, focus: e.target.value as ClassFocus })
                      }
                    >
                      {FOCUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.icon} {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="prog-intensity" label="Intensity">
                    <Select
                      value={programForm.intensity}
                      onChange={(e) =>
                        setProgramForm({
                          ...programForm,
                          intensity: e.target.value as Intensity,
                        })
                      }
                    >
                      {INTENSITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field id="prog-duration" label="Duration (min)">
                    <Input
                      type="number"
                      value={programForm.durationMin}
                      onChange={(e) =>
                        setProgramForm({
                          ...programForm,
                          durationMin: Number(e.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field id="prog-desc" label="Description" className="sm:col-span-2">
                    <Input
                      value={programForm.description}
                      onChange={(e) =>
                        setProgramForm({ ...programForm, description: e.target.value })
                      }
                      placeholder="What is this program about?"
                    />
                  </Field>
                  <div className="flex gap-2 sm:col-span-2">
                    <Button onClick={handleAddProgram} className="rounded-full">
                      <Plus className="h-4 w-4" /> Create program
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowAddProgram(false)}
                      className="rounded-full"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
