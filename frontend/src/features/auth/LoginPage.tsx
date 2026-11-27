import { CircleUserRound, Eye, EyeOff, Loader2, Lock, Moon, Sun } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type Location, Navigate, useLocation } from "react-router-dom";

import gym from "@/assets/login-gym.jpg";
import { LanguageSwitch } from "@/components/layout/TopNav";
import { errorText } from "@/i18n/domain";
import type { MessageKey } from "@/i18n/en";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";

type Msg = { key: MessageKey } | { text: string };

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const location = useLocation();
  const from = (location.state as { from?: Location } | null)?.from;
  const target = from ? `${from.pathname}${from.search}${from.hash}` : "/";

  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  // keep message keys (not text) so they re-translate when the language changes
  const [error, setError] = useState<Msg | null>(null);
  const [info, setInfo] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null; // a stored session is being checked
  if (user) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!userId.trim() || !password) {
      setError({ key: "login.missing" });
      return;
    }
    setBusy(true);
    try {
      await login(userId.trim(), password); // `user` is set → the <Navigate> above takes over
    } catch (err) {
      setError({ text: errorText(t, err) });
      setBusy(false);
    }
  };

  const help = (key: MessageKey) => {
    setError(null);
    setInfo(key);
  };

  return (
    <div className="login">
      <div className="login-slashes" aria-hidden="true">
        <i />
        <i />
      </div>
      <header className="login-top">
        <span className="login-logo" aria-label="FITYES">
          FITYES<sup>®</sup>
        </span>
        <div className="login-top-right">
          <LanguageSwitch />
          <button type="button" className="link" onClick={() => help("login.helpMsg")}>
            {t("login.needHelp")}
          </button>
        </div>
      </header>

      <div className="login-center">
        <div className="login-card">
          <form className="login-form" onSubmit={submit} noValidate>
            <div className="eyebrow">{t("login.eyebrow")}</div>
            <h1>{t("login.title")}</h1>
            <p className="lead">{t("login.lead")}</p>

            <label className="lbl" htmlFor="uid">
              {t("login.userId")}
            </label>
            <div className="login-input">
              <CircleUserRound size={24} strokeWidth={1.6} aria-hidden="true" />
              <input
                id="uid"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t("login.userIdPh")}
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoFocus
              />
            </div>

            <label className="lbl" htmlFor="pwd">
              {t("login.password")}
            </label>
            <div className="login-input">
              <Lock size={22} strokeWidth={1.7} aria-hidden="true" />
              <input
                id="pwd"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                placeholder={t("login.passwordPh")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={t(show ? "login.hide" : "login.show")}>
                {show ? <EyeOff size={22} strokeWidth={1.7} /> : <Eye size={22} strokeWidth={1.7} />}
              </button>
            </div>

            <button type="button" className="forgot" onClick={() => help("login.forgotMsg")}>
              {t("login.forgot")}
            </button>

            {error && (
              <div className="login-msg login-error" role="alert">
                {"key" in error ? t(error.key) : error.text}
              </div>
            )}
            {info && (
              <div className="login-msg login-info" role="status">
                {t(info)}
              </div>
            )}

            <button className="signin" type="submit" disabled={busy}>
              {busy && <Loader2 size={20} className="animate-spin" />}
              {t(busy ? "login.submitting" : "login.submit")}
            </button>

            <div className="login-foot">
              <Lock size={18} strokeWidth={1.8} aria-hidden="true" /> {t("login.secure")}
            </div>
          </form>
          <div className="login-photo" style={{ backgroundImage: `url(${gym})` }} role="img" aria-label={t("login.photo")} />
        </div>
      </div>

      <button className="icon-btn login-theme" onClick={toggle} aria-label={t("nav.theme")} title={t("nav.theme")}>
        {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}
