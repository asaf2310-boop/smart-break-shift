import React from "react";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";



export const DEMO_FIELD_CLASS = "login-demo-input text-right";

export const DEMO_SUBMIT_CLASS =

  "login-demo-submit w-full rounded-2xl font-semibold text-white tracking-wide disabled:opacity-50 transition-all duration-200";

export const BRAND_SUBMIT_CLASS = DEMO_SUBMIT_CLASS;



export function LoginShell({

  subtitle,

  showDemoBadge,

  /** Centered glass card on html.app-hyp-demo — no logo hero image */

  hypCard = false,

  production = false,

  heading = "כניסת נציג",

  children,

}) {

  return (

    <motion.div

      className={cn(

        "login-shell",

        hypCard && "login-hero-shell login-hero-bg login-shell--demo",

        production && !hypCard && "login-shell--prod m3-page"

      )}

      dir="rtl"

    >

      {!hypCard && (

        <h1

          className={cn(

            "relative z-10 text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-10 shrink-0",

            production ? "text-foreground" : "text-white"

          )}

        >

          {heading}

        </h1>

      )}



      <motion.div

        className={cn("login-shell__content", hypCard && "login-shell__content--demo")}

        initial={

          hypCard &&

          typeof window !== "undefined" &&

          !window.matchMedia("(prefers-reduced-motion: reduce)").matches

            ? { opacity: 0, y: 20 }

            : false

        }

        animate={{ opacity: 1, y: 0 }}

        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: hypCard ? 0.08 : 0 }}

      >

        <motion.div

          initial={

            hypCard || production

              ? false

              : typeof window !== "undefined" &&

                  window.matchMedia("(prefers-reduced-motion: reduce)").matches

                ? false

                : { opacity: 0, scale: 0.96, y: 16 }

          }

          animate={production && !hypCard ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}

          transition={{ duration: hypCard || production ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}

          className={cn(

            "relative z-10 w-full min-h-0",

            hypCard ? "login-shell__card-wrap" : "max-w-sm sm:max-w-md px-2"

          )}

        >

          <div

            className={cn(

              "login-shell__card w-full",

              hypCard ? "login-shell__card--demo login-card" : "p-5 sm:p-8"

            )}

          >

            <header className="login-shell__card-header">

              {hypCard ? (

                <h2 className="login-shell__title">{subtitle}</h2>

              ) : (

                <p

                  className={cn(

                    "login-shell__subtitle",

                    production ? "text-muted-foreground" : ""

                  )}

                >

                  {subtitle}

                </p>

              )}

              {showDemoBadge && (

                <span className="login-demo-badge" aria-label="סביבת דמו">

                  סביבת דמו

                </span>

              )}

            </header>

            {children}

          </div>

        </motion.div>

      </motion.div>

    </motion.div>

  );

}



export function Field({ icon: Icon, label, children }) {

  return (

    <div className="login-demo-field">

      <label className="login-demo-field__label">{label}</label>

      <motion.div

        className="relative"

        whileFocus={{ scale: 1.01 }}

        transition={{ duration: 0.2 }}

      >

        <Icon className="login-demo-field__icon" aria-hidden />

        <div className="pr-10">{children}</div>

      </motion.div>

    </div>

  );

}

