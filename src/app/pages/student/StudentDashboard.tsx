import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import BrowseResearch from '../../components/student/BrowseResearch';
import MyApplications from '../../components/student/MyApplications';
import StudentProfile from '../../components/student/StudentProfile';

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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl">Student Research Portal</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {needsProfile && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
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
          <TabsList className="bg-transparent p-0 gap-2">
            <TabsTrigger
              value="browse"
              className="rounded-md border border-border bg-transparent text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              Browse Research
            </TabsTrigger>
            <TabsTrigger
              value="applications"
              className="rounded-md border border-border bg-transparent text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-border data-[state=active]:shadow-none"
            >
              My Applications
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="rounded-md border border-border bg-transparent text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:border-border data-[state=active]:shadow-none"
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
