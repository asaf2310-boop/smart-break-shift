import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  MessageSquare,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmptyFlowStep,
  DEFAULT_INVALID_INPUT_MESSAGE,
  FLOW_CONDITION_VARIABLES,
  FLOW_INPUT_MODES,
  FLOW_INVALID_HANDLERS,
  FLOW_STEP_TYPES,
  FLOW_TRIGGER_TYPES,
  FLOW_VALIDATION_TYPES,
  getCustomerChatBotFlow,
  getFlowStepById,
  makeFlowStepId,
  removeFlowStep,
  resetCustomerChatBotFlow,
  saveCustomerChatBotFlow,
  subscribeCustomerChatBotFlow,
} from "@/lib/customerChatBotFlowConfig";

const STEP_ICONS = {
  start: Play,
  message: MessageSquare,
  choice: Zap,
  condition: GitBranch,
  transfer: UserRound,
};

function stepSummary(step) {
  if (!step) return "";
  if (step.type === "message") return step.body || "—";
  if (step.type === "choice") {
    const modeLabel = FLOW_INPUT_MODES[step.inputMode]?.label || step.inputMode;
    if (step.inputMode === "buttons") return step.prompt || `${step.options?.length || 0} אפשרויות`;
    return step.prompt || modeLabel;
  }
  if (step.type === "condition") {
    const varLabel = FLOW_CONDITION_VARIABLES[step.variable]?.label || step.variable;
    return varLabel;
  }
  if (step.type === "transfer") return step.handoffMessage || "העברה לנציג";
  return step.label || FLOW_STEP_TYPES[step.type]?.label || step.type;
}

function StepNextSelect({ label, value, steps, currentStepId, onChange, allowEmpty = true }) {
  const options = steps.filter((s) => s.id !== currentStepId);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-600">{label}</Label>
      <Select value={value || "__none__"} onValueChange={(v) => onChange(v === "__none__" ? null : v)}>
        <SelectTrigger className="text-right" dir="rtl">
          <SelectValue placeholder="בחר שלב" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          {allowEmpty && <SelectItem value="__none__">— ללא —</SelectItem>}
          {options.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.label || FLOW_STEP_TYPES[s.type]?.label} ({s.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StepEditor({ step, steps, onChange }) {
  if (!step) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
        בחרו שלב מהרשימה לעריכה
      </div>
    );
  }

  const patch = (updates) => onChange({ ...step, ...updates });

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">{FLOW_STEP_TYPES[step.type]?.label || step.type}</Badge>
        <Input
          value={step.label || ""}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder="שם השלב (פנימי)"
          className="flex-1 min-w-[10rem] text-right"
          dir="rtl"
        />
      </div>

      {step.type === "start" && (
        <StepNextSelect
          label="השלב הבא"
          value={step.nextStepId}
          steps={steps}
          currentStepId={step.id}
          onChange={(nextStepId) => patch({ nextStepId })}
        />
      )}

      {step.type === "message" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">טקסט ההודעה</Label>
            <Textarea
              value={step.body || ""}
              onChange={(e) => patch({ body: e.target.value })}
              placeholder="מה הבוט יכתוב ללקוח?"
              className="text-right min-h-[88px]"
              dir="rtl"
            />
          </div>
          <StepNextSelect
            label="השלב הבא"
            value={step.nextStepId}
            steps={steps}
            currentStepId={step.id}
            onChange={(nextStepId) => patch({ nextStepId })}
          />
        </>
      )}

      {step.type === "choice" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">שאלה / הנחיה לפני הקלט</Label>
            <Textarea
              value={step.prompt || ""}
              onChange={(e) => patch({ prompt: e.target.value })}
              placeholder="למשל: במה נוכל לעזור?"
              className="text-right min-h-[72px]"
              dir="rtl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">סוג קלט</Label>
            <Select
              value={step.inputMode || "buttons"}
              onValueChange={(inputMode) => patch({ inputMode })}
            >
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {Object.values(FLOW_INPUT_MODES).map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500">
              {FLOW_INPUT_MODES[step.inputMode || "buttons"]?.description}
            </p>
          </div>

          {(step.inputMode || "buttons") === "buttons" && (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">כפתורי תשובה מהירה</Label>
                {(step.options || []).map((opt, index) => (
                  <div
                    key={opt.id}
                    className="flex flex-col sm:flex-row gap-2 items-start rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <Input
                      value={opt.label}
                      onChange={(e) => {
                        const options = [...(step.options || [])];
                        options[index] = { ...opt, label: e.target.value };
                        patch({ options });
                      }}
                      placeholder={`כפתור ${index + 1}`}
                      className="flex-1 text-right"
                      dir="rtl"
                    />
                    <div className="w-full sm:w-48">
                      <StepNextSelect
                        label="ממשיך ל"
                        value={opt.nextStepId}
                        steps={steps}
                        currentStepId={step.id}
                        onChange={(nextStepId) => {
                          const options = [...(step.options || [])];
                          options[index] = { ...opt, nextStepId };
                          patch({ options });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-slate-400 hover:text-red-600"
                      onClick={() =>
                        patch({ options: (step.options || []).filter((o) => o.id !== opt.id) })
                      }
                      aria-label="מחק אפשרות"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() =>
                    patch({
                      options: [
                        ...(step.options || []),
                        { id: makeFlowStepId("opt"), label: "", nextStepId: null },
                      ],
                    })
                  }
                >
                  <Plus className="w-4 h-4" />
                  הוסף כפתור
                </Button>
              </div>
              <StepNextSelect
                label="ברירת מחדל (אם לא נבחר כפתור)"
                value={step.fallbackNextStepId}
                steps={steps}
                currentStepId={step.id}
                onChange={(fallbackNextStepId) => patch({ fallbackNextStepId })}
              />
            </>
          )}

          {(step.inputMode === "text" || step.inputMode === "freeText") && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">כלל אימות</Label>
                <Select
                  value={step.validationType || "none"}
                  onValueChange={(validationType) => patch({ validationType })}
                >
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.values(FLOW_VALIDATION_TYPES).map((v) => (
                      <SelectItem key={v.key} value={v.key}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {FLOW_VALIDATION_TYPES[step.validationType]?.needsValue && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">ערך לאימות</Label>
                  <Input
                    value={step.validationValue || ""}
                    onChange={(e) => patch({ validationValue: e.target.value })}
                    placeholder={FLOW_VALIDATION_TYPES[step.validationType]?.valuePlaceholder}
                    className="text-right"
                    dir="rtl"
                  />
                </div>
              )}

              <StepNextSelect
                label="לאחר קלט תקין — ממשיך ל"
                value={step.nextStepId}
                steps={steps}
                currentStepId={step.id}
                onChange={(nextStepId) => patch({ nextStepId })}
              />

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <Label htmlFor={`allow-image-${step.id}`} className="text-xs text-slate-600 cursor-pointer">
                  אפשר צירוף תמונה
                </Label>
                <Switch
                  id={`allow-image-${step.id}`}
                  checked={Boolean(step.allowImageAttachment)}
                  onCheckedChange={(allowImageAttachment) => patch({ allowImageAttachment })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">בקלט לא תקין</Label>
                <Select
                  value={step.onInvalid || "retry"}
                  onValueChange={(onInvalid) => patch({ onInvalid })}
                >
                  <SelectTrigger className="text-right" dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {Object.values(FLOW_INVALID_HANDLERS).map((h) => (
                      <SelectItem key={h.key} value={h.key}>
                        {h.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {step.onInvalid === "retry" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">מספר ניסיונות מקסימלי</Label>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    value={step.maxRetries ?? 3}
                    onChange={(e) => patch({ maxRetries: Number(e.target.value) })}
                    className="text-right w-24"
                    dir="rtl"
                  />
                  <p className="text-[11px] text-slate-500">לאחר חריגה — חוזרים לשלב הקודם</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-600">הודעת שגיאה ללקוח</Label>
                <Input
                  value={step.invalidMessage || DEFAULT_INVALID_INPUT_MESSAGE}
                  onChange={(e) => patch({ invalidMessage: e.target.value })}
                  placeholder={DEFAULT_INVALID_INPUT_MESSAGE}
                  className="text-right"
                  dir="rtl"
                />
              </div>
            </>
          )}
        </>
      )}

      {step.type === "condition" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">משתנה לבדיקה</Label>
            <Select value={step.variable || "merchant_ref_set"} onValueChange={(v) => patch({ variable: v })}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {Object.values(FLOW_CONDITION_VARIABLES).map((v) => (
                  <SelectItem key={v.key} value={v.key}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {FLOW_CONDITION_VARIABLES[step.variable]?.needsValue && (
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">ערך לחיפוש</Label>
              <Input
                value={step.value || ""}
                onChange={(e) => patch({ value: e.target.value })}
                placeholder={FLOW_CONDITION_VARIABLES[step.variable]?.valuePlaceholder}
                className="text-right"
                dir="rtl"
              />
            </div>
          )}
          <StepNextSelect
            label="אם התנאי מתקיים"
            value={step.nextStepIdWhenTrue}
            steps={steps}
            currentStepId={step.id}
            onChange={(nextStepIdWhenTrue) => patch({ nextStepIdWhenTrue })}
          />
          <StepNextSelect
            label="אם לא — המתן לקלט / ענף חלופי"
            value={step.nextStepIdWhenFalse}
            steps={steps}
            currentStepId={step.id}
            onChange={(nextStepIdWhenFalse) => patch({ nextStepIdWhenFalse })}
          />
        </>
      )}

      {step.type === "transfer" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-600">הודעת מעבר לנציג</Label>
            <Input
              value={step.handoffMessage || ""}
              onChange={(e) => patch({ handoffMessage: e.target.value })}
              placeholder="מחבר אתכם לנציג…"
              className="text-right"
              dir="rtl"
            />
          </div>
          <StepNextSelect
            label="לאחר העברה"
            value={step.nextStepId}
            steps={steps}
            currentStepId={step.id}
            onChange={(nextStepId) => patch({ nextStepId })}
          />
        </>
      )}

      {step.type === "end" && (
        <p className="text-xs text-slate-500">שלב סיום — הבוט מפסיק לפעול לאחר הגעה לכאן.</p>
      )}
    </div>
  );
}

export default function CustomerChatBotFlowAdmin() {
  const [draft, setDraft] = useState(() => getCustomerChatBotFlow());
  const [selectedStepId, setSelectedStepId] = useState(() => draft.entryStepId);
  const [saved, setSaved] = useState(false);

  const syncFromStore = useCallback(() => {
    const next = getCustomerChatBotFlow();
    setDraft(next);
    if (!getFlowStepById(next, selectedStepId)) {
      setSelectedStepId(next.entryStepId || next.steps[0]?.id || null);
    }
  }, [selectedStepId]);

  useEffect(() => subscribeCustomerChatBotFlow(syncFromStore), [syncFromStore]);

  const selectedStep = useMemo(
    () => draft.steps.find((s) => s.id === selectedStepId) || null,
    [draft.steps, selectedStepId]
  );

  const updateStep = (updated) => {
    setSaved(false);
    setDraft((prev) => ({
      ...prev,
      steps: prev.steps.map((s) => (s.id === updated.id ? updated : s)),
    }));
  };

  const addStep = (type) => {
    const step = createEmptyFlowStep(type);
    if (!step) return;
    setSaved(false);
    setDraft((prev) => {
      const steps = [...prev.steps, step];
      let entryStepId = prev.entryStepId;
      if (type === "start" && !entryStepId) entryStepId = step.id;
      return { ...prev, steps, entryStepId };
    });
    setSelectedStepId(step.id);
  };

  const removeStep = (stepId) => {
    if (draft.steps.length <= 1) {
      window.alert("לא ניתן למחוק את השלב האחרון בתהליך.");
      return;
    }
    const isEntry = stepId === draft.entryStepId;
    const message = isEntry
      ? "למחוק את שלב הכניסה? נקודת הכניסה תועבר לשלב התחלה אחר או לשלב הראשון ברשימה. קישורים לשלב זה יוסרו."
      : "למחוק את השלב? קישורים לשלב זה יוסרו משאר השלבים.";
    if (!window.confirm(message)) return;
    setSaved(false);
    setDraft((prev) => {
      const next = removeFlowStep(prev, stepId);
      if (selectedStepId === stepId) {
        setSelectedStepId(next.entryStepId || next.steps[0]?.id || null);
      }
      return next;
    });
  };

  const moveStep = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draft.steps.length) return;
    setSaved(false);
    setDraft((prev) => {
      const steps = [...prev.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps };
    });
  };

  const handleSave = () => {
    const cleaned = {
      ...draft,
      name: String(draft.name || "").trim() || "תהליך",
      steps: draft.steps.map((s) => {
        if (s.type === "message") return { ...s, body: String(s.body || "").trim() };
        if (s.type === "choice") {
          return {
            ...s,
            prompt: String(s.prompt || "").trim(),
            options: (s.options || [])
              .map((o) => ({ ...o, label: String(o.label || "").trim() }))
              .filter((o) => o.label),
            validationValue: String(s.validationValue || "").trim(),
            invalidMessage:
              String(s.invalidMessage || DEFAULT_INVALID_INPUT_MESSAGE).trim() ||
              DEFAULT_INVALID_INPUT_MESSAGE,
          };
        }
        return s;
      }),
    };
    saveCustomerChatBotFlow(cleaned);
    setDraft(getCustomerChatBotFlow());
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    if (!window.confirm("לאפס את תהליך הבוט לברירת המחדל?")) return;
    resetCustomerChatBotFlow();
    const next = getCustomerChatBotFlow();
    setDraft(next);
    setSelectedStepId(next.entryStepId);
    setSaved(false);
  };

  const triggerLabel = FLOW_TRIGGER_TYPES[draft.trigger?.type]?.label || "פתיחת שיחה";

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold text-slate-800">בניית Flow</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            עורך תהליך שיחה מבוסס שלבים — בהשראת בונה ה-flows של LiveChat: טריגר, הודעות, כפתורי תשובה
            מהירה, תנאים והעברה לנציג.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
          <Label htmlFor="flow-enabled" className="text-sm font-medium text-slate-700 cursor-pointer">
            Flow פעיל
          </Label>
          <Switch
            id="flow-enabled"
            checked={Boolean(draft.enabled)}
            onCheckedChange={(enabled) => {
              setSaved(false);
              setDraft((prev) => ({ ...prev, enabled }));
            }}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">שם התהליך</Label>
          <Input
            value={draft.name || ""}
            onChange={(e) => {
              setSaved(false);
              setDraft((prev) => ({ ...prev, name: e.target.value }));
            }}
            className="text-right"
            dir="rtl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">טריגר</Label>
          <Input value={triggerLabel} readOnly className="text-right bg-slate-50" dir="rtl" />
        </div>
      </div>

      {!draft.enabled && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          כש-Flow כבוי, נשמרת התנהגות ההודעות הישנה (שלבי sessionStart / beforeAgent). הפעילו Flow כדי
          להריץ את התהליך החדש.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-slate-800">שלבים בתהליך</h3>
            <Select onValueChange={addStep}>
              <SelectTrigger className="w-[10.5rem] h-8 text-xs" dir="rtl">
                <SelectValue placeholder="הוסף שלב" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {Object.values(FLOW_STEP_TYPES).map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto pe-1">
            {draft.steps.length === 0 && (
              <p className="text-xs text-slate-400 italic">אין שלבים — הוסיפו שלב התחלה</p>
            )}
            {draft.steps.map((step, index) => {
              const Icon = STEP_ICONS[step.type] || MessageSquare;
              const isEntry = step.id === draft.entryStepId;
              const isSelected = step.id === selectedStepId;
              return (
                <div key={step.id} className="relative">
                  {index > 0 && (
                    <div className="absolute -top-2 right-5 w-px h-2 bg-slate-200" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedStepId(step.id)}
                    className={`w-full text-right rounded-2xl border px-3 py-2.5 transition-colors ${
                      isSelected
                        ? "border-sky-300 bg-sky-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {step.label || FLOW_STEP_TYPES[step.type]?.label}
                          </span>
                          {isEntry && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              כניסה
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{stepSummary(step)}</p>
                      </div>
                      <div className="flex flex-col gap-0.5 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(index, -1);
                          }}
                          disabled={index === 0}
                          aria-label="הזז למעלה"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            moveStep(index, 1);
                          }}
                          disabled={index === draft.steps.length - 1}
                          aria-label="הזז למטה"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 disabled:opacity-40"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeStep(step.id);
                          }}
                          disabled={draft.steps.length <= 1}
                          aria-label="מחק שלב"
                          title="מחק שלב"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </button>
                  {index < draft.steps.length - 1 && (
                    <div className="flex justify-center py-0.5 text-slate-300" aria-hidden>
                      <ArrowDown className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {selectedStep && (
            <div className="flex flex-wrap gap-2 pt-1">
              {selectedStep.type === "start" && selectedStep.id !== draft.entryStepId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSaved(false);
                    setDraft((prev) => ({ ...prev, entryStepId: selectedStep.id }));
                  }}
                >
                  קבע כנקודת כניסה
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 gap-1 disabled:opacity-40"
                disabled={draft.steps.length <= 1}
                onClick={() => removeStep(selectedStep.id)}
              >
                <Trash2 className="w-4 h-4" />
                מחק שלב
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-800">עריכת שלב</h3>
          <StepEditor step={selectedStep} steps={draft.steps} onChange={updateStep} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
        <Button type="button" onClick={handleSave}>
          שמור Flow
        </Button>
        <Button type="button" variant="outline" onClick={handleReset} className="gap-1">
          <RotateCcw className="w-4 h-4" />
          איפוס לברירת מחדל
        </Button>
        {saved && <span className="text-sm text-emerald-600 font-medium">נשמר בהצלחה</span>}
      </div>
    </div>
  );
}
