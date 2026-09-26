import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/cn';

interface BlurTextProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}

// Word-by-word blur-in when scrolled into view (React Bits "BlurText").
export const BlurText: React.FC<BlurTextProps> = ({
  text,
  className,
  delay = 0,
  stagger = 0.05
}) => (
  <motion.p
    className={cn(className)}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, amount: 0.5 }}
  >
    {text.split(' ').map((word, i) => (
      <motion.span
        key={i}
        className="inline-block"
        variants={{
          hidden: { opacity: 0, filter: 'blur(10px)', y: 8 },
          show: {
            opacity: 1,
            filter: 'blur(0px)',
            y: 0,
            transition: { delay: delay + i * stagger, duration: 0.5, ease: 'easeOut' }
          }
        }}
      >
        {word}
        {' '}
      </motion.span>
    ))}
  </motion.p>
);
