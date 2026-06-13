import { useMemo, useState } from "react";
import type { AgentQuestionAnswerPayload, AgentQuestionPrompt } from "@mimica/shared";

export interface QuestionCardProps {
  question: AgentQuestionPrompt;
  disabled?: boolean;
  onSubmit?: (payload: AgentQuestionAnswerPayload) => void;
  onDismiss?: () => void;
}

export function QuestionCard({
  question,
  disabled = false,
  onSubmit,
  onDismiss,
}: QuestionCardProps) {
  const isResolved = question.status !== "pending";
  const readOnly = disabled || isResolved;

  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(question.questions.map((item) => [item.id, []])),
  );
  const [freeformByQuestion, setFreeformByQuestion] = useState<Record<string, string>>(() =>
    Object.fromEntries(question.questions.map((item) => [item.id, ""])),
  );

  const showFallbackBadge = question.source === "tool_call_stream";

  const canSubmit = useMemo(() => {
    if (readOnly) return false;
    return question.questions.some((item) => {
      const selected = selectedByQuestion[item.id] ?? [];
      const freeform = freeformByQuestion[item.id]?.trim() ?? "";
      return selected.length > 0 || freeform.length > 0;
    });
  }, [freeformByQuestion, question.questions, readOnly, selectedByQuestion]);

  const toggleOption = (questionId: string, optionId: string, allowMultiple: boolean) => {
    if (readOnly) return;
    setSelectedByQuestion((prev) => {
      const current = prev[questionId] ?? [];
      if (allowMultiple) {
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { ...prev, [questionId]: next };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || !onSubmit) return;
    onSubmit({
      questionPromptId: question.id,
      answers: question.questions.map((item) => ({
        questionId: item.id,
        selectedOptionIds: selectedByQuestion[item.id] ?? [],
        freeformText: freeformByQuestion[item.id]?.trim() || undefined,
      })),
    });
  };

  return (
    <section
      className={`question-card ${readOnly ? "is-resolved" : ""}`}
      aria-label="確認質問"
      aria-describedby={showFallbackBadge ? `question-card-hint-${question.id}` : undefined}
    >
      <header className="question-card-head">
        {question.title ? <h3 className="question-card-title">{question.title}</h3> : null}
        {showFallbackBadge ? (
          <span
            id={`question-card-hint-${question.id}`}
            className="question-card-badge"
            title="回答は follow-up として送信されます（同一 run 続行ではありません）"
          >
            確認待ち
          </span>
        ) : null}
      </header>

      <div className="question-card-body">
        {question.questions.map((item) => (
          <fieldset key={item.id} className="question-card-fieldset" disabled={readOnly}>
            <legend className="question-card-prompt">{item.prompt}</legend>
            <div className="question-card-options">
              {item.options.map((option) => {
                const checked = (selectedByQuestion[item.id] ?? []).includes(option.id);
                const inputType = item.allowMultiple ? "checkbox" : "radio";
                return (
                  <label key={option.id} className="question-card-option">
                    <input
                      type={inputType}
                      name={`question-${question.id}-${item.id}`}
                      value={option.id}
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => toggleOption(item.id, option.id, item.allowMultiple)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
            <label className="question-card-freeform">
              <span className="question-card-freeform-label">自由記述（任意）</span>
              <textarea
                rows={2}
                value={freeformByQuestion[item.id] ?? ""}
                disabled={readOnly}
                placeholder="補足があれば入力"
                onChange={(event) =>
                  setFreeformByQuestion((prev) => ({
                    ...prev,
                    [item.id]: event.target.value,
                  }))
                }
              />
            </label>
          </fieldset>
        ))}
      </div>

      {!readOnly ? (
        <footer className="question-card-actions">
          <button
            type="button"
            className="question-card-dismiss"
            disabled={disabled}
            onClick={onDismiss}
          >
            スキップ
          </button>
          <button
            type="button"
            className="question-card-submit"
            disabled={disabled || !canSubmit}
            onClick={handleSubmit}
          >
            回答を送信
          </button>
        </footer>
      ) : (
        <p className="question-card-status" aria-live="polite">
          {question.status === "answered"
            ? "回答済み"
            : question.status === "dismissed"
              ? "スキップ済み"
              : question.status === "expired"
                ? "期限切れ"
                : null}
        </p>
      )}
    </section>
  );
}
