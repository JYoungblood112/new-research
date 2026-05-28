import { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserRole } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { GraduationCap, Microscope, UserRound, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  const handleRoleSelection = (role: UserRole) => {
    setSelectedRole(role);
    navigate(`/sso?role=${role}`);
  };

  return (
    <section className="flex min-h-screen flex-col bg-[#eeecea] text-gray-900">
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-10 sm:px-10">
        <div className="w-full">
          <div className="text-center">
            <div className="mb-8 inline-flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-700/10">
                <Microscope className="size-5 text-red-700" />
              </div>
              <span className="text-[40px] font-medium tracking-tight text-gray-900 sm:text-[44px]">CMU Research Match</span>
            </div>
            <h1 className="text-[52px] font-bold leading-[1.03] tracking-[-0.02em] text-balance text-gray-900 text-[#0f0f0f] sm:text-[64px]">
              Welcome
            </h1>
            <p className="mt-4 text-[16px] font-normal text-[#777777]">
              Select Student or Professor to continue to CMU SSO
            </p>
          </div>

          <div className="mx-auto mt-8 grid w-full max-w-4xl grid-cols-1 gap-5 sm:grid-cols-2" role="tablist" aria-label="Role selection">
            <Button
              role="tab"
              aria-selected={selectedRole === 'student'}
              onClick={() => handleRoleSelection('student')}
              variant="outline"
              className={`h-auto w-full cursor-pointer flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-3xl border p-6 text-left transition-colors duration-150 focus-visible:ring-red-700/35 ${
                selectedRole === 'student'
                  ? 'border-red-700/65 bg-red-700/[0.03] ring-1 ring-red-700/20'
                  : 'border-[#cccccc] bg-white hover:border-red-700/50 hover:bg-red-700/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-red-700/[0.15]">
                  <GraduationCap className="size-6 text-red-700" />
                </div>
                <ArrowRight className="size-4 text-red-700/50" />
              </div>
              <div className="mt-3">
                <h3 className="text-[18px] font-semibold leading-tight text-gray-900">Student</h3>
                <p className="mt-1 text-[14px] font-normal text-gray-500">
                  Find and apply to research opportunities
                </p>
              </div>
            </Button>

            <Button
              role="tab"
              aria-selected={selectedRole === 'professor'}
              onClick={() => handleRoleSelection('professor')}
              variant="outline"
              className={`h-auto w-full cursor-pointer flex-col items-stretch justify-start overflow-hidden whitespace-normal rounded-3xl border p-6 text-left transition-colors duration-150 focus-visible:ring-red-700/35 ${
                selectedRole === 'professor'
                  ? 'border-red-700/65 bg-red-700/[0.03] ring-1 ring-red-700/20'
                  : 'border-[#cccccc] bg-white hover:border-red-700/50 hover:bg-red-700/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex size-12 items-center justify-center rounded-xl bg-red-700/[0.15]">
                  <UserRound className="size-6 text-red-700" />
                </div>
                <ArrowRight className="size-4 text-red-700/50" />
              </div>
              <div className="mt-3">
                <h3 className="text-[18px] font-semibold leading-tight text-gray-900">Professor</h3>
                <p className="mt-1 text-[14px] font-normal text-gray-500">
                  Post projects and review student applications
                </p>
              </div>
            </Button>
          </div>

          <div className="mt-5 text-center text-[13px] font-normal text-[#999999]">
            Choose a role to continue directly to CMU SSO.
          </div>
        </div>
      </div>
    </section>
  );
}
