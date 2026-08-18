'use client';

interface PasswordRequirement {
    label: string;
    met: boolean;
}

interface PasswordStrengthIndicatorProps {
    password: string;
}

export default function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
    const requirements: PasswordRequirement[] = [
        {
            label: 'At least 8 characters',
            met: password.length >= 8
        },
        {
            label: 'One uppercase letter',
            met: /[A-Z]/.test(password)
        },
        {
            label: 'One lowercase letter',
            met: /[a-z]/.test(password)
        },
        {
            label: 'One special character',
            met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        }
    ];

    const metCount = requirements.filter(r => r.met).length;
    const strength = metCount === 0 ? 'none' : metCount <= 2 ? 'weak' : metCount === 3 ? 'medium' : 'strong';

    const strengthColors = {
        none: 'bg-white/10',
        weak: 'bg-white/30',
        medium: 'bg-white/60',
        strong: 'bg-white'
    };

    const strengthLabels = {
        none: '',
        weak: 'Weak',
        medium: 'Medium',
        strong: 'Strong'
    };

    if (!password) return null;

    return (
        <div className="mt-3 space-y-3">
            {/* Strength Bar */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-gray-300">Password Strength</span>
                    {strength !== 'none' && (
                        <span className="text-xs font-medium text-white">
                            {strengthLabels[strength]}
                        </span>
                    )}
                </div>
                <div className="flex gap-1.5">
                    {[1, 2, 3, 4].map((bar) => (
                        <div
                            key={bar}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${bar <= metCount ? strengthColors[strength] : 'bg-white/[0.1]'
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Requirements Checklist */}
            <div className="space-y-2">
                {requirements.map((req, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center transition-all ${req.met
                            ? 'bg-white/20 border border-white/50'
                            : 'bg-white/[0.05] border border-white/[0.1]'
                            }`}>
                            {req.met && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </div>
                        <span className={req.met ? 'text-white' : 'text-gray-300'}>
                            {req.label}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
