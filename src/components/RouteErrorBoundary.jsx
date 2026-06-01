import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[RouteErrorBoundary]", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = error?.message || String(error);

    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50 px-4"
        dir="rtl"
      >
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-white p-6 shadow-lg">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">לא ניתן לטעון את העמוד</h1>
              <p className="text-sm text-slate-600 mt-1">
                אירעה שגיאה בלתי צפויה. נסו לרענן או לחזור לדף הבית.
              </p>
            </div>
          </div>
          {message && (
            <p className="text-xs text-red-800/90 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4 font-mono break-all">
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
            >
              רענון
            </button>
            <Link
              to="/"
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              דף הבית
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
