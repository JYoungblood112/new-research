import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useNavigate } from 'react-router';
import BrowseResearch from '../../components/student/BrowseResearch';
import MyApplications from '../../components/student/MyApplications';
import StudentProfile from '../../components/student/StudentProfile';
import { Header as AppHeader } from '../../../components/ui/header-1';

export default function StudentDashboard() {
  const { user, logout, setupState } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const needsProfile = !setupState?.completed;

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <AppHeader
        className="border-b border-[#e6dfdc] bg-[linear-gradient(120deg,#fffdfa_0%,#fff7f5_45%,#f8f7fb_100%)]"
        brand={
          <div className="space-y-0.5 px-1 py-0.5 text-left">
            <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8b7f79]">Student Workspace</p>
            <p className="text-sm font-semibold text-[#111111]">Student Research Portal</p>
          </div>
        }
        links={[
          {
            label: 'Browse',
            href: '#',
            onClick: (event) => {
              event.preventDefault();
              setActiveTab('browse');
            },
          },
          {
            label: 'Applications',
            href: '#',
            onClick: (event) => {
              event.preventDefault();
              setActiveTab('applications');
            },
          },
          {
            label: 'Profile',
            href: '#',
            onClick: (event) => {
              event.preventDefault();
              setActiveTab('profile');
            },
          },
        ]}
        actions={[
          {
            label: user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'Student',
            variant: 'outline',
            onClick: () => setActiveTab('profile'),
          },
          {
            label: 'Logout',
            onClick: handleLogout,
          },
        ]}
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7">

        {needsProfile && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-red-700" />
                <p className="text-sm">
                  Please complete your profile and upload your resume to start applying to research
                  opportunities.
                </p>
              </div>
              <Button
                variant="link"
                className="h-auto p-0 text-red-800"
                onClick={() => setActiveTab('profile')}
              >
                Go to Profile →
              </Button>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-auto rounded-2xl border border-[#dddddd] bg-white p-1.5">
            <TabsTrigger
              value="browse"
              className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
            >
              Browse Research
            </TabsTrigger>
            <TabsTrigger
              value="applications"
              className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
            >
              My Applications
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
            >
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="browse">
            <BrowseResearch />
          </TabsContent>

          <TabsContent value="applications">
            <MyApplications />
          </TabsContent>

          <TabsContent value="profile">
            <StudentProfile />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
