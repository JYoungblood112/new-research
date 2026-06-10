import { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserRole } from '../contexts/AuthContext';
import { GraduationCap, BookOpen, ArrowRight, BriefcaseBusiness, Building2 } from 'lucide-react';

export default function LoginPage() {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const navigate = useNavigate();

  const handleRoleSelection = (role: UserRole) => {
    setSelectedRole(role);
    navigate(`/sso?role=${role}`);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden sm:flex sm:w-1/2 bg-gradient-to-br from-red-600 via-red-700 to-red-900 p-12 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10">
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/20">
                <GraduationCap className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">CMU Research</h1>
                <p className="text-red-100">Portal</p>
              </div>
            </div>
          </div>

          <div className="space-y-12">
            <div>
              <h2 className="text-4xl font-bold leading-tight mb-4">
                Connect with
                <br />
                groundbreaking
                <br />
                research
              </h2>
              <p className="text-red-100 text-lg">
                Join Carnegie Mellon's research community and advance your academic journey
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <div className="text-4xl font-bold mb-2">500+</div>
                <div className="text-red-100 text-sm">Research Projects</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                <div className="text-4xl font-bold mb-2">50+</div>
                <div className="text-red-100 text-sm">Departments</div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
              <div className="flex items-start gap-3">
                <div className="text-3xl">&quot;</div>
                <div>
                  <p className="text-white/90 mb-3 italic">
                    This platform connected me with cutting-edge AI research and transformed my academic path.
                  </p>
                  <div className="text-sm">
                    <div className="font-semibold">Sarah Chen</div>
                    <div className="text-red-100">CS Graduate Student</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/20 pt-6">
          <p className="text-red-100 text-sm">(c) 2026 Carnegie Mellon University</p>
          <p className="text-red-200 text-xs mt-1">Empowering the next generation of researchers</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="sm:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">CMU Research</h1>
              <p className="text-gray-500 text-sm">Portal</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome</h2>
                <p className="text-gray-600">Choose your role to get started</p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => handleRoleSelection('dean')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 transition-colors">
                        <Building2 className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">Dean</h3>
                        <p className="text-sm text-gray-500">Measure institutional research outcomes</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection('recruiter')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                        <BriefcaseBusiness className="w-6 h-6 text-slate-700" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">Recruiter</h3>
                        <p className="text-sm text-gray-500">Find verified student research talent</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection('professor')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 transition-colors">
                        <BookOpen className="w-6 h-6 text-red-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">Professor</h3>
                        <p className="text-sm text-gray-500">Post research opportunities</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </div>
                </button>

                <button
                  onClick={() => handleRoleSelection('student')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <GraduationCap className="w-6 h-6 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">Student</h3>
                        <p className="text-sm text-gray-500">Find and apply to research</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-red-600 transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 mt-6">
            Need help? Contact <span className="text-red-600">research-support@andrew.cmu.edu</span>
          </p>
        </div>
      </div>
    </div>
  );
}
