import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

interface SplitTextProps {
  text: string;
  className?: string;
  charClassName?: string;
  delay?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
}

// Letter-by-letter rise + unblur (React Bits "SplitText"). Words never break mid-word.
export const SplitText: React.FC<SplitTextProps> = ({
  text,
  className,
  charClassName,
  delay = 0,
  stagger = 0.025,
  as = 'span'
}) => {
  const Tag = motion[as];
  let index = 0;

  return (
    <Tag
      className={cn('inline', className)}
      aria-label={text}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.4 }}
    >
      {text.split(' ').map((word, wi, arr) => (
        <span key={wi} aria-hidden className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch) => {
            const i = index++;
            return (
              <motion.span
                key={i}
                className={cn('inline-block will-change-transform', charClassName)}
                variants={{
                  hidden: { opacity: 0, y: '0.45em', filter: 'blur(8px)' },
                  show: {
                    opacity: 1,
                    y: 0,
                    filter: 'blur(0px)',
                    transition: {
                      delay: delay + i * stagger,
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1]
                    }
                  }
                }}
              >
                {ch}
              </motion.span>
            );
          })}
          {wi < arr.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
};
