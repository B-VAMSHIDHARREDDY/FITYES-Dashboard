import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";

import { useI18n } from "@/i18n/I18nProvider";

interface Props {
  value: number;
  format: (n: number) => string;
  className?: string;
  duration?: number;
}

function Tween({ value, format, className, duration = 0.6 }: Props) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => format(v));

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [mv, value, duration]);

  return <motion.span className={className ? `tabular ${className}` : "tabular"}>{text}</motion.span>;
}

/** Smoothly tweens between numeric values — the "re-rates as you move" feel. Re-mounts on language change
 *  so the number is re-formatted in the new locale immediately. */
export function AnimatedNumber(props: Props) {
  const { lang } = useI18n();
  return <Tween key={lang} {...props} />;
}
