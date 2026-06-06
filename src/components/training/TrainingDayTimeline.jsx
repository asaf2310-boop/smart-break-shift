import React from "react";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Coffee,
  ExternalLink,
  GraduationCap,
  Headphones,
  Link2,
  Presentation,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

function resolveSessionIcon(session) {
  if (session.isBreak) return Coffee;

  const haystack = `${session.id} ${session.title} ${session.description ?? ""}`.toLowerCase();

  if (/break|הפסקה|lunch/.test(haystack)) return Coffee;
  if (/listen|האזנ|headphone|שיח/.test(haystack)) return Headphones;
  if (/exam|מבחן|coaching|חניכ/.test(haystack)) return GraduationCap;
  if (/crm|portal|פורטל|לקוח|team|מוקד|call-center/.test(haystack)) return Users;
  if (/security|shield|סליק|acquiring/.test(haystack)) return ShieldCheck;
  if (/book|חומר|review|חזרה|intake|קליטה/.test(haystack)) return BookOpen;

  return Brain;
}

function SessionTimelineCard({ session, displayDate, contentStatus, onOpen, isLast }) {
  const isBreak = session.isBreak;
  const hasContent = contentStatus?.hasPdf || contentStatus?.hasUrl;
  const hasUrl = contentStatus?.hasUrl;
  const hasPdf = contentStatus?.hasPdf;
  const Icon = resolveSessionIcon(session);

  let actionHint = "";
  if (!isBreak && hasContent) {
    if (hasUrl) actionHint = "לחצו למעבר לקישור";
    else if (hasPdf) actionHint = "לחצו לפתיחת המסמך בטאב חדש";
  }

  const cardBody = (
    <div
      className={cn(
        "training-timeline-card",
        isBreak && "training-timeline-card--break",
        !isBreak && hasContent && "training-timeline-card--interactive"
      )}
    >
      <div className="training-timeline-card__icon-wrap" aria-hidden="true">
        <Icon className="training-timeline-card__icon" />
      </div>

      <div className="training-timeline-card__body">
        <h3 className="training-timeline-card__title">{session.title}</h3>
        {session.description ? (
          <p className="training-timeline-card__description">{session.description}</p>
        ) : null}
        {actionHint ? <p className="training-timeline-card__hint">{actionHint}</p> : null}
      </div>

      <div className="training-timeline-card__meta">
        <span className="training-timeline-card__time">{session.timeLabel}</span>
        <div className="training-timeline-card__badges">
          {isBreak && (
            <span className="training-timeline-badge training-timeline-badge--break">
              <Coffee className="training-timeline-badge__icon" />
              הפסקה
            </span>
          )}
          {!isBreak && hasUrl && (
            <span className="training-timeline-badge training-timeline-badge--link">
              <Link2 className="training-timeline-badge__icon" />
              קישור
            </span>
          )}
          {!isBreak && hasPdf && (
            <span className="training-timeline-badge training-timeline-badge--presentation">
              <Presentation className="training-timeline-badge__icon" />
              מצגת
            </span>
          )}
        </div>
        {!isBreak && hasContent && (
          <span className="training-timeline-card__open" aria-hidden="true">
            <ExternalLink className="training-timeline-card__open-icon" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <li
      className={cn(
        "training-timeline-item",
        isBreak && "training-timeline-item--break",
        !isBreak && hasContent && "training-timeline-item--active",
        isLast && "training-timeline-item--last"
      )}
    >
      <div className="training-timeline-node" aria-hidden="true" />
      {isBreak ? (
        <div className="training-timeline-card-wrap">{cardBody}</div>
      ) : (
        <button
          type="button"
          onClick={() => onOpen({ ...session, displayDate })}
          disabled={!hasContent}
          className={cn(
            "training-timeline-card-wrap",
            "training-timeline-card-btn",
            !hasContent && "training-timeline-card-btn--disabled"
          )}
        >
          {cardBody}
        </button>
      )}
    </li>
  );
}

export default function TrainingDayTimeline({ day, availability, onOpenSession, onBack }) {
  const sessionCount = day.sessions.filter((session) => !session.isBreak).length;

  return (
    <div className="training-timeline-root space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="training-timeline-back m3-btn-outlined text-xs py-2 gap-1.5 shrink-0"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לימי השבוע
        </button>
        <p className="training-timeline-hint m3-label-medium text-center flex-1 min-w-[10rem]">
          לחצו על מפגש לקישור או מצגת
        </p>
      </div>

      <header className="training-timeline-header">
        <div className="training-timeline-header__glow" aria-hidden="true" />
        <div className="training-timeline-header__content">
          <div className="training-timeline-header__top">
            <div className="training-timeline-header__titles">
              <p className="training-timeline-header__welcome">ברוכים הבאים ליום ההדרכה</p>
              <h2 className="training-timeline-header__day">יום {day.weekdayLabel}</h2>
              <p className="training-timeline-header__date">{day.displayDate}</p>
            </div>
            <span className="training-timeline-header__count">
              {sessionCount} מפגשים
            </span>
          </div>
        </div>
      </header>

      <ol className="training-timeline-list">
        {day.sessions.map((session, index) => (
          <SessionTimelineCard
            key={session.id}
            session={session}
            displayDate={day.displayDate}
            contentStatus={availability[session.id]}
            onOpen={onOpenSession}
            isLast={index === day.sessions.length - 1}
          />
        ))}
      </ol>

      <footer className="training-timeline-footer">
        <div className="training-timeline-footer__block">
          <div className="training-timeline-footer__heading">
            <Target className="training-timeline-footer__icon" aria-hidden="true" />
            <h3 className="training-timeline-footer__title">מטרה יומית</h3>
          </div>
          <p className="training-timeline-footer__text">
            להשלים את כל מפגשי ההדרכה של היום, לעבור על החומר הזמין ולהגיע מוכנים לשלב הבא בקורס.
          </p>
        </div>
        <div className="training-timeline-footer__divider" aria-hidden="true" />
        <div className="training-timeline-footer__block">
          <div className="training-timeline-footer__heading">
            <Sparkles className="training-timeline-footer__icon" aria-hidden="true" />
            <h3 className="training-timeline-footer__title">טיפ להצלחה</h3>
          </div>
          <p className="training-timeline-footer__text">
            רשמו שאלות במהלך ההדרכה, פתחו מצגות וקישורים בטאב נפרד, והשתמשו בהפסקות לריענון קצר.
          </p>
        </div>
      </footer>
    </div>
  );
}
