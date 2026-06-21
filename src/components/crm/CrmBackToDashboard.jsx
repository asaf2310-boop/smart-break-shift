import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CrmBackToDashboard({ onClick, className, to = "/crm" }) {
  const classes = cn(
    "inline-flex items-center gap-1 m3-label-medium hover:text-primary mb-4",
    className
  );

  if (typeof onClick === "function") {
    return (
      <button type="button" onClick={onClick} className={classes}>
        <ArrowRight className="w-4 h-4" />
        חזרה לדשבורד
      </button>
    );
  }

  return (
    <Link to={to} className={classes}>
      <ArrowRight className="w-4 h-4" />
      חזרה לדשבורד
    </Link>
  );
}
