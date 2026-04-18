import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const supabase = getSupabaseClient();

        if (!supabase) {
            setError('Database connection not configured.');
            return;
        }

        setLoading(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
        }
        setLoading(false);
    };

    return (
        <div className="flex items-center justify-center h-[60vh] w-full animate-in fade-in duration-500">
            <div className="w-full max-w-[360px] bg-white border border-black/5 rounded-[6px] p-8 shadow-sm">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-10 h-10 flex items-center justify-center bg-al-light-gray/40 rounded-[6px] mb-4 text-[#007aff]">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <h2 className="text-[19px] font-semibold text-al-near-black tracking-tight">Admin Access</h2>
                    <p className="text-[13px] text-al-mid-gray mt-1">Sign in to recalibrate AquaLife sensors</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2.5 bg-al-off-white border border-black/10 rounded-[6px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                            placeholder="Apple ID / Email"
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2.5 bg-al-off-white border border-black/10 rounded-[6px] text-[14px] focus:outline-none focus:ring-2 focus:ring-[#007aff]/30 focus:border-[#007aff] transition-all"
                            placeholder="Password"
                        />
                    </div>

                    {error && (
                        <div className="px-3 py-2 bg-[#ff3b30]/10 border border-[#ff3b30]/20 rounded-[6px]">
                            <p className="text-[12px] text-[#ff3b30] font-medium">{error}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 px-4 bg-[#007aff] hover:bg-[#005bb5] text-white text-[14px] font-medium rounded-[6px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2 shadow-sm"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}