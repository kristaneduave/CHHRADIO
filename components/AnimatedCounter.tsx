import React, { useEffect } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    className?: string;
    prefix?: string;
    suffix?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 1.5, className = '', prefix = '', suffix = '' }) => {
    const springValue = useSpring(0, {
        duration: duration * 1000,
        bounce: 0,
    });

    useEffect(() => {
        springValue.set(value);
    }, [value, springValue]);

    const display = useTransform(springValue, (current) => `${prefix}${Math.round(current)}${suffix}`);

    return <motion.span className={className}>{display}</motion.span>;
};

export default AnimatedCounter;
