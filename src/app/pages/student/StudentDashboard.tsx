import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { useNavigate } from 'react-router';
import BrowseResearch from '../../components/student/BrowseResearch';
import AIRecommendations from '../../components/student/AIRecommendations';
import MyApplications from '../../components/student/MyApplications';
import StudentProfile from '../../components/student/StudentProfile';
import ProgressReports from '../../components/student/ProgressReports';
import { Header as AppHeader } from '../../../components/ui/header-1';

const navigationItems = [
  { value: 'browse', label: 'Browse' },
  { value: 'recommendations', label: 'Recommendations' },
  { value: 'applications', label: 'Applications' },
  { value: 'progress', label: 'Reports' },
  { value: 'profile', label: 'Profile' },
];

export default function StudentDashboard() {
  const { user, logout, setupState } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('browse');
  const [canLeaveProfile, setCanLeaveProfile] = useState<null | (() => Promise<boolean>)>(null);

  const requestTabChange = async (nextTab: string) => {
    if (nextTab === activeTab) {
      return;
    }

    if (activeTab === 'profile' && nextTab !== 'profile' && canLeaveProfile) {
      const canLeave = await canLeaveProfile();
      if (!canLeave) {
        return;
      }
    }

    setActiveTab(nextTab);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const needsProfile = !setupState?.completed;

  return (
    <div className="app-shell min-h-screen bg-[#fbfaf8]">
      <AppHeader
        className="border-b border-[#eee7e3] bg-[#fffdfa]/95 backdrop-blur"
        brand={
          <div className="flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c92e1f] text-xs font-bold text-white">
              RP
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111111]">Research Portal</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7f79]">Student Workspace</p>
            </div>
          </div>
        }
        links={[]}
        actions={[
          {
            label: user?.name ? user.name.split(' ')[0] : 'Profile',
            variant: 'outline',
            onClick: () => {
              void requestTabChange('profile');
            },
          },
          {
            label: 'Logout',
            onClick: handleLogout,
          },
        ]}
      />

      <Tabs
        value={activeTab}
        onValueChange={(nextTab) => {
          void requestTabChange(nextTab);
        }}
      >
        <div className="border-b border-[#eee7e3] bg-[#fffdfa]/90">
          <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            <TabsList className="inline-flex h-9 min-w-max items-center justify-start rounded-lg bg-transparent p-0 shadow-none">
              {navigationItems.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="h-8 whitespace-nowrap rounded-md bg-transparent px-3 text-sm font-medium text-[#625b57] shadow-none data-[state=active]:bg-[#f0ebe8] data-[state=active]:text-[#111111] data-[state=active]:shadow-none sm:px-4"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
          {needsProfile && (
            <div className="status-danger rounded-lg px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  Complete your profile and upload your resume to unlock better match scores.
                </p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-red-800 hover:text-red-950"
                  onClick={() => {
                    void requestTabChange('profile');
                  }}
                >
                  Go to Profile {'->'}
                </Button>
              </div>
            </div>
          )}

          <TabsContent value="browse">
            <BrowseResearch />
          </TabsContent>

          <TabsContent value="recommendations">
            <AIRecommendations
              onBrowseResearch={() => {
                void requestTabChange('browse');
              }}
            />
          </TabsContent>

          <TabsContent value="applications">
            <MyApplications />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressReports />
          </TabsContent>

          <TabsContent value="profile">
            <StudentProfile
              onRegisterLeaveGuard={(handler) => {
                setCanLeaveProfile(() => handler);
              }}
            />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
}
