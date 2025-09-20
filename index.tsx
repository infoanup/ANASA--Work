import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- TYPE DEFINITIONS ---
type TaskStatus = 'todo' | 'in_progress' | 'done';
type Priority = 'low' | 'medium' | 'high';
type SortDirection = 'ascending' | 'descending';
type ProjectRole = 'Admin' | 'Member';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface ProjectMember {
  userId: string;
  role: ProjectRole;
}

interface ProjectJoinRequest {
    userId: string;
    timestamp: string;
}

interface Project {
  id:string;
  name: string;
  privacy: 'public' | 'restricted';
  members: ProjectMember[];
  joinRequests?: ProjectJoinRequest[];
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface Task {
  id: string;
  projectIds: string[];
  parentId: string | null;
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string | null;
  status: TaskStatus;
  priority: Priority;
  labelIds: string[];
  dependsOn: string[];
  reminderOffsetHours?: number | null;
}

interface Comment {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  timestamp: string;
}

interface Attachment {
    id: string;
    taskId: string;
    fileName: string;
    fileType: string;
    fileUrl: string; // Data URL for simplicity
    uploadedAt: string;
    uploaderId: string;
}

interface SortConfig {
    key: 'dueDate' | 'priority' | 'status' | 'title';
    direction: SortDirection;
}


// --- MOCK DATA ---
const initialUsers: User[] = [
  { id: 'user-1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com' },
  { id: 'user-2', firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com' },
  { id: 'user-3', firstName: 'Charlie', lastName: 'Day', email: 'charlie@example.com' },
];

const initialProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Website Redesign',
    privacy: 'restricted',
    members: [
        { userId: 'user-1', role: 'Admin' },
        { userId: 'user-2', role: 'Member' },
    ],
    joinRequests: [{ userId: 'user-3', timestamp: new Date().toISOString() }]
  },
  {
      id: 'proj-2',
      name: 'Mobile App V2',
      privacy: 'restricted',
      members: [{userId: 'user-2', role: 'Admin'}]
  },
  {
      id: 'proj-3',
      name: 'Public API',
      privacy: 'public',
      members: [{userId: 'user-1', role: 'Admin'}]
  }
];

const initialLabels: Label[] = [
    { id: 'label-1', name: 'Frontend', color: '#4299e1' },
    { id: 'label-2', name: 'Backend', color: '#f6ad55' },
    { id: 'label-3', name: 'Bug', color: '#e53e3e' },
    { id: 'label-4', name: 'Feature', color: '#48bb78' },
];

const initialTasks: Task[] = [
  {
    id: 'task-1',
    projectIds: ['proj-1'],
    parentId: null,
    title: 'Design new homepage',
    description: '<p>Create mockups and wireframes for the <b>new homepage</b> layout.</p><ul><li>Initial sketches</li><li>High-fidelity mockups</li></ul>',
    assigneeId: 'user-1',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'in_progress',
    priority: 'high',
    labelIds: ['label-1', 'label-4'],
    dependsOn: [],
    reminderOffsetHours: 24,
  },
   {
    id: 'task-1-1',
    projectIds: ['proj-1'],
    parentId: 'task-1',
    title: 'Create color palette (due today)',
    description: '',
    assigneeId: 'user-1',
    dueDate: new Date().toISOString(),
    status: 'todo',
    priority: 'medium',
    labelIds: ['label-1'],
    dependsOn: [],
  },
  {
    id: 'task-2',
    projectIds: ['proj-1'],
    parentId: null,
    title: 'Develop authentication flow (overdue)',
    description: '<p>Implement user registration and login functionality.</p>',
    assigneeId: 'user-2',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'todo',
    priority: 'high',
    labelIds: ['label-2'],
    dependsOn: [],
  },
  {
    id: 'task-3',
    projectIds: ['proj-1'],
    parentId: null,
    title: 'Setup staging environment',
    description: '<p>Configure the server and deployment pipeline for staging.</p>',
    assigneeId: null,
    dueDate: null,
    status: 'todo',
    priority: 'medium',
    labelIds: [],
    dependsOn: [],
  },
    {
    id: 'task-4',
    projectIds: ['proj-1'],
    parentId: null,
    title: 'Deploy to production',
    description: '',
    assigneeId: 'user-1',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'todo',
    priority: 'high',
    labelIds: [],
    dependsOn: ['task-2', 'task-3'],
  },
];

const initialComments: Comment[] = [
    { id: 'comment-1', taskId: 'task-1', authorId: 'user-2', content: 'Looks great! Can we try a version with a darker background?', timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: 'comment-2', taskId: 'task-1', authorId: 'user-1', content: 'Good idea, I\'ll mock that up now.', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString() },
];

const initialAttachments: Attachment[] = [
    { id: 'att-1', taskId: 'task-1', fileName: 'homepage-mockup-v1.png', fileType: 'image/png', fileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', uploadedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), uploaderId: 'user-1' }
];


// --- UTILITY FUNCTIONS ---
const formatDate = (dateString: string | null, includeTime = false) => {
  if (!dateString) return 'No due date';
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  };
  if (includeTime) {
      options.hour = 'numeric';
      options.minute = 'numeric';
      options.hour12 = true;
  }
  return new Date(dateString).toLocaleDateString('en-US', options);
};

const isTaskBlocked = (task: Task, allTasks: Task[]): boolean => {
    if (!task.dependsOn || task.dependsOn.length === 0) {
        return false;
    }
    return task.dependsOn.some(depId => {
        const prerequisite = allTasks.find(t => t.id === depId);
        return prerequisite ? prerequisite.status !== 'done' : false;
    });
};

const getDescendantIds = (taskId: string, allTasks: Task[]): string[] => {
    const descendants = new Set<string>();
    const findChildren = (parentId: string) => {
        const children = allTasks.filter(t => t.parentId === parentId);
        for (const child of children) {
            if (!descendants.has(child.id)) {
                descendants.add(child.id);
                findChildren(child.id);
            }
        }
    };
    findChildren(taskId);
    return Array.from(descendants);
};

// --- COMPONENTS ---

const Logo = () => (
    <div className="logo">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14 0L26.1244 7V21L14 28L1.87563 21V7L14 0Z" fill="var(--primary)" />
            <path d="M14 4.66667L22.1667 9.33333V18.6667L14 23.3333L5.83333 18.6667V9.33333L14 4.66667Z" fill="var(--background)" />
            <path d="M10.5 17.5L14 15.1667L17.5 17.5V10.5L14 12.8333L10.5 10.5V17.5Z" fill="var(--primary)" />
        </svg>
        <h1>ANASA</h1>
    </div>
);

const UserMenu = ({ user, onLogout, onOpenProfile }: { user: User, onLogout: () => void, onOpenProfile: () => void }) => (
    <div className="user-menu">
        <div className="user-info" onClick={onOpenProfile} role="button" tabIndex={0} title="Edit Profile">
            <div className="user-avatar">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</div>
            <span className="user-name">{user.firstName} {user.lastName}</span>
        </div>
        <div className="user-menu-actions">
            <button className="btn-icon" onClick={onOpenProfile} aria-label="My Profile" title="My Profile">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </button>
            <button className="btn-icon" onClick={onLogout} aria-label="Log Out" title="Log Out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
        </div>
    </div>
);

const RichTextEditor = ({ value, onChange }: { value: string; onChange: (value: string) => void }) => {
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    onChange(e.currentTarget.innerHTML);
  };

  const handleFormat = (command: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, null);
    if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="rich-text-editor">
      <div className="rte-toolbar">
        <button type="button" onClick={() => handleFormat('bold')} title="Bold"><b>B</b></button>
        <button type="button" onClick={() => handleFormat('italic')} title="Italic"><i>I</i></button>
        <button type="button" onClick={() => handleFormat('underline')} title="Underline"><u>U</u></button>
        <button type="button" onClick={() => handleFormat('insertUnorderedList')} title="Bullet List">&bull;</button>
        <button type="button" onClick={() => handleFormat('insertOrderedList')} title="Numbered List">1.</button>
      </div>
      <div
        ref={editorRef}
        className="form-control rte-content"
        contentEditable={true}
        onInput={handleInput}
      />
    </div>
  );
};

const MyTasks = ({
    tasks,
    projects,
    userId,
    onTaskClick,
}: {
    tasks: Task[];
    projects: Project[];
    userId: string;
    onTaskClick: (task: Task) => void;
}) => {
    const userTasksByProject = useMemo(() => {
        const assignedTasks = tasks.filter(t => t.assigneeId === userId && t.status !== 'done');
        const grouped = {} as Record<string, { projectName: string; tasks: Task[] }>;

        assignedTasks.forEach(task => {
            task.projectIds.forEach(projectId => {
                const project = projects.find(p => p.id === projectId);
                if (!project) return;

                if (!grouped[projectId]) {
                    grouped[projectId] = {
                        projectName: project.name,
                        tasks: [],
                    };
                }
                if (!grouped[projectId].tasks.some(t => t.id === task.id)) {
                    grouped[projectId].tasks.push(task);
                }
            });
        });

        Object.values(grouped).forEach(group => {
            group.tasks.sort((a, b) => {
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });
        });

        return Object.entries(grouped);
    }, [tasks, projects, userId]);

    if (userTasksByProject.length === 0) {
        return null;
    }

    const getDueDateStatus = (dueDate: string | null): 'overdue' | 'soon' | 'normal' => {
        if (!dueDate) return 'normal';
        const due = new Date(dueDate);
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        if (due < today) return 'overdue';
        if (due <= tomorrow) return 'soon';
        return 'normal';
    };

    return (
        <div className="my-tasks-section">
            <h2 className="sidebar-section-header">My Tasks</h2>
            {userTasksByProject.map(([projectId, { projectName, tasks }]) => (
                <div key={projectId} className="my-tasks-project-group">
                    <h3 className="my-tasks-project-name">{projectName}</h3>
                    <ul className="my-tasks-list">
                        {tasks.map(task => (
                            <li key={task.id} className="my-tasks-item" onClick={() => onTaskClick(task)}>
                                <span className={`my-tasks-due-indicator status-${getDueDateStatus(task.dueDate)}`}></span>
                                <span className="my-tasks-title">{task.title}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
};

const ProjectList = ({
  projects,
  tasks,
  selectedProjectId,
  onSelectProject,
  onNewProject,
  currentUser,
  onLogout,
  onEditTask,
  isSidebarOpen,
  onCloseSidebar,
  onJoinRequest,
  onOpenProfile,
}: {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  currentUser: User;
  onLogout: () => void;
  onEditTask: (task: Task) => void;
  isSidebarOpen: boolean;
  onCloseSidebar: () => void;
  onJoinRequest: (projectId: string) => void;
  onOpenProfile: () => void;
}) => {
    const handleMyTaskClick = (task: Task) => {
        onSelectProject(task.projectIds[0]);
        onEditTask(task);
        onCloseSidebar();
    };
    
    const handleProjectSelect = (id: string) => {
        onSelectProject(id);
        onCloseSidebar();
    }
    
    const userProjects = projects.filter(p => p.members.some(m => m.userId === currentUser.id));
    const availableProjects = projects.filter(p => !p.members.some(m => m.userId === currentUser.id) && p.privacy === 'restricted');


    return (
      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div>
            <div className="sidebar-header">
                <Logo />
                <button className="btn-icon mobile-close-btn" onClick={onCloseSidebar} aria-label="Close Menu">&times;</button>
            </div>
            
            <MyTasks
                tasks={tasks}
                projects={userProjects}
                userId={currentUser.id}
                onTaskClick={handleMyTaskClick}
            />

            <div className="project-list-header">
                <h2 className="sidebar-section-header">Projects</h2>
                <button className="btn-icon" onClick={onNewProject} aria-label="Create New Project">+</button>
            </div>
            <ul className="project-list">
              {userProjects.map((project) => (
                <li
                  key={project.id}
                  className={`project-item ${project.id === selectedProjectId ? 'active' : ''}`}
                  onClick={() => handleProjectSelect(project.id)}
                  role="button"
                  tabIndex={0}
                  aria-pressed={project.id === selectedProjectId}
                >
                  <span>{project.name}</span>
                  {project.privacy === 'restricted' && <span className="project-privacy-icon" title="Restricted">🔒</span>}
                </li>
               ))}
                {availableProjects.length > 0 && availableProjects.map(project => {
                    const hasPendingRequest = project.joinRequests?.some(r => r.userId === currentUser.id);
                     return (
                         <li key={project.id} className="project-item non-member">
                            <span className="project-item-name-group">
                               <span>{project.name}</span>
                               <span className="project-privacy-icon" title="Restricted">🔒</span>
                            </span>
                            <button 
                                className="btn btn-join" 
                                onClick={() => onJoinRequest(project.id)}
                                disabled={hasPendingRequest}
                            >
                                {hasPendingRequest ? 'Pending' : 'Join'}
                            </button>
                        </li>
                    )
                })}
            </ul>
        </div>
        <UserMenu user={currentUser} onLogout={onLogout} onOpenProfile={onOpenProfile} />
      </aside>
    );
};

type TaskItemProps = {
  task: Task;
  users: User[];
  allTasks: Task[];
  allLabels: Label[];
  onEdit: (task: Task) => void;
};

const TaskItem = ({ task, users, allTasks, allLabels, onEdit }: TaskItemProps) => {
  const assignee = users.find((u) => u.id === task.assigneeId);
  const taskLabels = allLabels.filter(label => task.labelIds.includes(label.id));
  const blocked = isTaskBlocked(task, allTasks);
  const [isJustCompleted, setIsJustCompleted] = useState(false);
  const prevStatusRef = useRef<TaskStatus>();

  const blockingTasksTooltip = useMemo(() => {
    if (!blocked) return '';
    const blockingTaskTitles = task.dependsOn
      .map(depId => {
        const prerequisite = allTasks.find(t => t.id === depId);
        return prerequisite && prerequisite.status !== 'done' ? prerequisite.title : null;
      })
      .filter(Boolean);
    
    if (blockingTaskTitles.length === 0) return '';
    return `Blocked by: ${blockingTaskTitles.join(', ')}`;
  }, [blocked, task.dependsOn, allTasks]);

  useEffect(() => {
    const previousStatus = prevStatusRef.current;
    if (previousStatus && previousStatus !== 'done' && task.status === 'done') {
        setIsJustCompleted(true);
        const timer = setTimeout(() => {
            setIsJustCompleted(false);
        }, 1200);
        return () => clearTimeout(timer);
    }
    prevStatusRef.current = task.status;
  }, [task.status]);


  const isOverdue = useMemo(() => {
    if (!task.dueDate || task.status === 'done') {
        return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  }, [task.dueDate, task.status]);

  const taskCardClasses = [
    'task-card',
    blocked ? 'blocked' : '',
    isOverdue ? 'overdue' : '',
    task.status === 'done' ? 'completed' : '',
    isJustCompleted ? 'just-completed' : ''
  ].filter(Boolean).join(' ');

  return (
    <div className={taskCardClasses} onClick={() => onEdit(task)} role="button" tabIndex={0} title={blockingTasksTooltip}>
      <div className="task-labels">
        {taskLabels.map(label => (
          <span key={label.id} className="label-tag" style={{ backgroundColor: label.color }}>
            {label.name}
          </span>
        ))}
      </div>
      <h3>{task.title}</h3>
      <div className="task-meta">
        <div className="task-assignee">
          <span>{assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Unassigned'}</span>
        </div>
        <div className={`task-due-date ${isOverdue ? 'overdue' : ''}`}>
          <span>{formatDate(task.dueDate)}</span>
        </div>
      </div>
      <div className="task-footer">
        <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
        <span className={`task-status status-${task.status.replace(/_/g, '')}`}>{task.status.replace(/_/g, ' ')}</span>
      </div>
    </div>
  );
};

const TaskList = ({ tasks, users, allTasks, allLabels, onEditTask, sortConfig }: { tasks: Task[]; users: User[]; allTasks: Task[], allLabels: Label[], onEditTask: (task: Task) => void, sortConfig: SortConfig }) => {
    const tasksById = useMemo(() => new Map(tasks.map(t => [t.id, t])), [tasks]);
    // FIX: Corrected the syntax for the useMemo hook by placing the dependency array inside the function call.
    const tasksByParentId = useMemo(() =>
        tasks.reduce((map, task) => {
            const parentId = task.parentId || null;
            if (!map.has(parentId)) {
                map.set(parentId, []);
            }
            map.get(parentId)!.push(task);
            return map;
        }, new Map<string | null, Task[]>())
    , [tasks]);

    const priorityOrder: { [key in Priority]: number } = { 'low': 1, 'medium': 2, 'high': 3 };
    const statusOrder: { [key in TaskStatus]: number } = { 'todo': 1, 'in_progress': 2, 'done': 3 };

    const sortTasks = useCallback((tasksToSort: Task[]) => {
        return [...tasksToSort].sort((a, b) => {
            const { key, direction } = sortConfig;
            let comparison = 0;

            if (key === 'priority') {
                comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
            } else if (key === 'status') {
                comparison = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
            } else if (key === 'dueDate') {
                if (a.dueDate === b.dueDate) comparison = 0;
                else if (a.dueDate === null) comparison = 1;
                else if (b.dueDate === null) comparison = -1;
                else comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            } else {
                comparison = a.title.localeCompare(b.title);
            }

            return direction === 'ascending' ? comparison : -comparison;
        });
    }, [sortConfig]);


    const renderSubtasks = (parentId: string) => {
        const children = tasksByParentId.get(parentId) || [];
        if (children.length === 0) return null;
        
        const sortedChildren = sortTasks(children);

        return (
            <div className="subtask-container">
                {sortedChildren.map(task => (
                    <div key={task.id}>
                        <TaskItem
                            task={task}
                            users={users}
                            allTasks={allTasks}
                            allLabels={allLabels}
                            onEdit={onEditTask}
                        />
                        {renderSubtasks(task.id)}
                    </div>
                ))}
            </div>
        );
    };

    const rootTasks = tasks.filter(t => t.parentId === null || !tasksById.has(t.parentId!));
    const sortedRootTasks = sortTasks(rootTasks);

    return (
        <div className="task-list">
            {sortedRootTasks.map(task => (
                <div key={task.id} className="task-lane">
                    <TaskItem
                        task={task}
                        users={users}
                        allTasks={allTasks}
                        allLabels={allLabels}
                        onEdit={onEditTask}
                    />
                    {renderSubtasks(task.id)}
                </div>
            ))}
        </div>
    );
};


const FilterBar = ({
    users,
    filters,
    onFilterChange,
    sortConfig,
    onSortChange,
}: {
    users: User[];
    filters: { searchTerm: string; assigneeId: string; status: string; };
    onFilterChange: (newFilters: Partial<{ searchTerm: string; assigneeId: string; status: string; }>) => void;
    sortConfig: SortConfig;
    onSortChange: (newConfig: SortConfig) => void;
}) => {
    return (
        <div className="filter-bar">
            <input
                type="text"
                className="form-control"
                placeholder="Search tasks..."
                value={filters.searchTerm}
                onChange={e => onFilterChange({ searchTerm: e.target.value })}
            />
            <select
                className="form-control"
                value={filters.assigneeId}
                onChange={e => onFilterChange({ assigneeId: e.target.value })}
            >
                <option value="all">All Assignees</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
            </select>
            <select
                className="form-control"
                value={filters.status}
                onChange={e => onFilterChange({ status: e.target.value })}
            >
                <option value="all">All Statuses</option>
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
            </select>
            <div className="sort-controls">
                <label htmlFor="sort-key" className="sort-label">Sort by</label>
                <select
                    id="sort-key"
                    className="form-control"
                    value={sortConfig.key}
                    onChange={e => onSortChange({ ...sortConfig, key: e.target.value as SortConfig['key'] })}
                >
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                    <option value="title">Title</option>
                </select>
                <button
                    className="btn-icon sort-direction"
                    onClick={() => onSortChange({ ...sortConfig, direction: sortConfig.direction === 'ascending' ? 'descending' : 'ascending' })}
                    aria-label={`Sort ${sortConfig.direction === 'ascending' ? 'descending' : 'ascending'}`}
                    title={`Sort ${sortConfig.direction === 'ascending' ? 'descending' : 'ascending'}`}
                >
                    {sortConfig.direction === 'ascending' ? '↑' : '↓'}
                </button>
            </div>
        </div>
    );
};


const ProjectDetail = ({
  project,
  tasks,
  users,
  allTasks,
  allLabels,
  filters,
  onFilterChange,
  sortConfig,
  onSortChange,
  onNewTask,
  onEditTask,
  onOpenProjectSettings,
  onToggleSidebar,
}: {
  project: Project | undefined;
  tasks: Task[];
  users: User[];
  allTasks: Task[];
  allLabels: Label[];
  filters: any;
  onFilterChange: (newFilters: any) => void;
  sortConfig: SortConfig;
  onSortChange: (newConfig: SortConfig) => void;
  onNewTask: () => void;
  onEditTask: (task: Task) => void;
  onOpenProjectSettings: (projectId: string) => void;
  onToggleSidebar: () => void;
}) => {
  if (!project) {
    return <main className="project-detail"><h1>Select a project</h1></main>;
  }
  
  const hasPendingRequests = (project.joinRequests?.length ?? 0) > 0;

  return (
    <main className="project-detail">
      <div className="project-header">
        <div className="project-title-group">
            <button className="btn-icon mobile-menu-btn" onClick={onToggleSidebar} aria-label="Open Menu">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <h1>{project.name}</h1>
            <button className="btn-icon settings-btn" onClick={() => onOpenProjectSettings(project.id)} title="Project Settings">
                {hasPendingRequests && <span className="notification-badge"></span>}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V15a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
        </div>
        <button className="btn btn-primary" onClick={onNewTask}>
          + Create New Task
        </button>
      </div>
      <FilterBar
          users={users}
          filters={filters}
          onFilterChange={onFilterChange}
          sortConfig={sortConfig}
          onSortChange={onSortChange}
      />
      <TaskList tasks={tasks} users={users} allTasks={allTasks} allLabels={allLabels} onEditTask={onEditTask} sortConfig={sortConfig} />
    </main>
  );
};

const TaskModal = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  onEditTask,
  onAddComment,
  onAddAttachment,
  onDeleteAttachment,
  task,
  users,
  allTasks,
  allLabels,
  memberProjects,
  comments,
  attachments,
  projectId,
  currentUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  onAddComment: (comment: { taskId: string; content: string; authorId: string }) => void;
  onAddAttachment: (attachments: Omit<Attachment, 'id'>[]) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  task: Partial<Task> | null;
  users: User[];
  allTasks: Task[];
  allLabels: Label[];
  memberProjects: Project[];
  comments: Comment[];
  attachments: Attachment[];
  projectId: string;
  currentUser: User;
}) => {
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [reminderSelection, setReminderSelection] = useState<string>('none');
  const [customReminderHours, setCustomReminderHours] = useState<number>(1);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!task?.id;
  const blocked = useMemo(() => task?.id ? isTaskBlocked(task as Task, allTasks) : false, [task, allTasks]);
  const descendantIds = useMemo(() => (task?.id ? getDescendantIds(task.id, allTasks) : []), [task?.id, allTasks]);
  const taskComments = useMemo(() =>
    comments
        .filter(c => c.taskId === task?.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [comments, task?.id]
  );
  const taskAttachments = useMemo(() =>
    attachments
        .filter(a => a.taskId === task?.id)
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    [attachments, task?.id]
  );
  
  const potentialAssignees = useMemo(() => {
    const selectedProjectIds = new Set(formData.projectIds || []);
    const relevantProjects = memberProjects.filter(p => selectedProjectIds.has(p.id));

    if (relevantProjects.length === 0 || relevantProjects.every(p => p.privacy === 'public')) {
        return users;
    }

    const memberIds = new Set<string>();
    relevantProjects.forEach(p => {
        p.members.forEach(m => memberIds.add(m.userId));
    });
    return users.filter(u => memberIds.has(u.id));
  }, [formData.projectIds, memberProjects, users]);

  useEffect(() => {
    if (task) {
      const dateForInput = task.dueDate ? task.dueDate.substring(0, 16) : '';
      setFormData({ ...task, dueDate: dateForInput });
      if (task.reminderOffsetHours === null || task.reminderOffsetHours === undefined) {
        setReminderSelection('none');
      } else if ([0, 1, 24].includes(task.reminderOffsetHours)) {
        setReminderSelection(String(task.reminderOffsetHours));
      } else {
        setReminderSelection('custom');
        setCustomReminderHours(task.reminderOffsetHours);
      }
    } else {
        setFormData({
            title: '',
            description: '',
            assigneeId: null,
            dueDate: '',
            status: 'todo',
            priority: 'medium',
            labelIds: [],
            dependsOn: [],
            reminderOffsetHours: null,
            parentId: null,
            projectIds: [projectId]
        });
        setReminderSelection('none');
        setCustomReminderHours(1);
    }
    setNewSubtaskTitle('');
    setNewComment('');
  }, [task, projectId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleDescriptionChange = (newDescription: string) => {
      setFormData(prev => ({...prev, description: newDescription}));
  }

  const handleLabelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({ ...prev, labelIds: selectedOptions }));
  };

  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    if (selectedOptions.length === 0) return;
    setFormData(prev => ({...prev, projectIds: selectedOptions}));
  }
  
  const buildTaskFromState = (): Task => {
    let reminderOffset: number | null = null;
    if (reminderSelection !== 'none' && reminderSelection !== 'custom') {
        reminderOffset = parseInt(reminderSelection, 10);
    } else if (reminderSelection === 'custom') {
        reminderOffset = customReminderHours > 0 ? customReminderHours : 0;
    }

    return {
        id: formData.id || `task-${Date.now()}`,
        projectIds: formData.projectIds || [projectId],
        parentId: formData.parentId || null,
        title: formData.title || 'Untitled Task',
        description: formData.description || '',
        assigneeId: formData.assigneeId || null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
        status: formData.status || 'todo',
        priority: formData.priority || 'medium',
        labelIds: formData.labelIds || [],
        dependsOn: formData.dependsOn || [],
        reminderOffsetHours: reminderOffset,
    };
  }

  const handleSave = () => {
    onSave(buildTaskFromState());
  };

  const handleAddSubtask = () => {
      if (!newSubtaskTitle.trim() || !task?.id) return;
      const subtask: Task = {
          id: `task-${Date.now()}`,
          projectIds: task.projectIds || [projectId],
          parentId: task.id,
          title: newSubtaskTitle,
          description: '',
          assigneeId: null,
          dueDate: null,
          status: 'todo',
          priority: 'medium',
          labelIds: [],
          dependsOn: [],
      };
      onSave(subtask);
      setNewSubtaskTitle('');
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !task?.id) return;
    onAddComment({
        taskId: task.id,
        content: newComment,
        authorId: currentUser.id,
    });
    setNewComment('');
  };
  
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || !task?.id) return;
        
        const newAttachments: Omit<Attachment, 'id'>[] = [];
        
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                newAttachments.push({
                    taskId: task.id!,
                    fileName: file.name,
                    fileType: file.type,
                    fileUrl: e.target?.result as string,
                    uploadedAt: new Date().toISOString(),
                    uploaderId: currentUser.id,
                });

                if (newAttachments.length === files.length) {
                    onAddAttachment(newAttachments);
                }
            };
            reader.readAsDataURL(file);
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    
    const triggerFileUpload = () => {
        fileInputRef.current?.click();
    };

  const handleDateShortcut = (days: number | 'clear') => {
      if (days === 'clear') {
          setFormData(prev => ({ ...prev, dueDate: '' }));
          return;
      }
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + days);
      setFormData(prev => ({...prev, dueDate: newDate.toISOString().substring(0, 16) }));
  }

  const handleEditSubtask = (subtask: Task) => {
    // Save current task before switching
    onSave(buildTaskFromState());
    // Open subtask
    onEditTask(subtask);
  }

  if (!isOpen) return null;
  const modalContentClass = `modal-content ${isEditing ? 'large' : ''}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={modalContentClass} style={{maxWidth: isEditing ? '800px': '600px'}} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Task' : 'Create New Task'}</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>

        <input
          type="text"
          name="title"
          className="form-control"
          placeholder="Task Title"
          value={formData.title || ''}
          onChange={handleChange}
          style={{ fontSize: '1.2rem', fontWeight: '600' }}
        />
        
        <div className="form-group">
            <label>Description</label>
            <RichTextEditor value={formData.description || ''} onChange={handleDescriptionChange} />
        </div>

        <div className="form-grid">
            <div className="form-group">
                <label htmlFor="assigneeId">Assignee</label>
                <select
                    id="assigneeId"
                    name="assigneeId"
                    className="form-control"
                    value={formData.assigneeId || 'null'}
                    onChange={handleChange}
                >
                    <option value="null">Unassigned</option>
                    {potentialAssignees.map(u => (
                        <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                    ))}
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" className="form-control" value={formData.status} onChange={handleChange}>
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done" disabled={blocked}>Done</option>
                </select>
                {blocked && <p className="blocked-warning" style={{marginTop: '8px'}}>Cannot be marked as done until prerequisites are completed.</p>}
            </div>
            <div className="form-group">
                <label htmlFor="dueDate">Due Date</label>
                <div className="date-picker-wrapper">
                    <input
                        type="datetime-local"
                        id="dueDate"
                        name="dueDate"
                        className="form-control"
                        value={formData.dueDate || ''}
                        onChange={handleChange}
                    />
                     <div className="date-picker-shortcuts">
                        <button className="btn-shortcut" onClick={() => handleDateShortcut(0)}>Today</button>
                        <button className="btn-shortcut" onClick={() => handleDateShortcut(1)}>Tomorrow</button>
                        <button className="btn-shortcut" onClick={() => handleDateShortcut(7)}>Next Week</button>
                        <button className="btn-shortcut" onClick={() => handleDateShortcut('clear')}>Clear</button>
                    </div>
                </div>
            </div>
            <div className="form-group">
                <label htmlFor="priority">Priority</label>
                <select id="priority" name="priority" className="form-control" value={formData.priority} onChange={handleChange}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                </select>
            </div>
            <div className="form-group">
                <label htmlFor="labelIds">Labels</label>
                <select id="labelIds" name="labelIds" multiple className="form-control" value={formData.labelIds} onChange={handleLabelChange}>
                    {allLabels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
            </div>
            <div className="form-group">
                 <label htmlFor="projectIds">Projects</label>
                 <select
                     id="projectIds"
                     name="projectIds"
                     multiple
                     className="form-control"
                     value={formData.projectIds}
                     onChange={handleProjectChange}
                 >
                     {memberProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
            </div>
        </div>

        <div className="form-group">
            <label htmlFor="dependsOn">Depends On</label>
            <select
                id="dependsOn"
                name="dependsOn"
                multiple
                className="form-control"
                value={formData.dependsOn}
                onChange={e => setFormData(prev => ({...prev, dependsOn: Array.from(e.target.selectedOptions, o => o.value)}))}
            >
                {allTasks.filter(t => t.id !== task?.id && !descendantIds.includes(t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                ))}
            </select>
        </div>
        
        <div className="form-group">
            <label>Reminder</label>
            <div className="reminder-group">
                <select
                    className="form-control"
                    value={reminderSelection}
                    onChange={(e) => setReminderSelection(e.target.value)}
                >
                    <option value="none">No reminder</option>
                    <option value="0">On due date</option>
                    <option value="1">1 hour before</option>
                    <option value="24">24 hours before</option>
                    <option value="custom">Custom</option>
                </select>
                {reminderSelection === 'custom' && (
                    <input
                        type="number"
                        className="form-control"
                        value={customReminderHours}
                        onChange={(e) => setCustomReminderHours(parseInt(e.target.value, 10))}
                        min="1"
                    />
                )}
            </div>
        </div>
        
        {isEditing && (
            <>
                <div className="subtask-section">
                    <h3>Subtasks</h3>
                    <div className="subtask-list">
                        {(allTasks.filter(t => t.parentId === task?.id).length > 0) ? (
                            allTasks.filter(t => t.parentId === task?.id).map(subtask => (
                                <div key={subtask.id} className="subtask-item">
                                    <span>{subtask.title}</span>
                                    <button className="btn btn-sm btn-secondary" onClick={() => handleEditSubtask(subtask)}>View</button>
                                </div>
                            ))
                        ) : (
                           <p className="no-subtasks">No subtasks yet.</p>
                        )}
                    </div>
                    <div className="add-subtask-form">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="New subtask title..."
                            value={newSubtaskTitle}
                            onChange={(e) => setNewSubtaskTitle(e.target.value)}
                            onKeyPress={e => e.key === 'Enter' && handleAddSubtask()}
                        />
                        <button className="btn btn-primary" onClick={handleAddSubtask}>Add</button>
                    </div>
                </div>

                <div className="attachments-section">
                    <h3>Attachments</h3>
                    <div className="attachment-list">
                        {taskAttachments.length > 0 ? (
                            taskAttachments.map(attachment => (
                                <div key={attachment.id} className="attachment-item">
                                    <div className="file-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                    </div>
                                    <div className="attachment-info">
                                        <span className="attachment-name">{attachment.fileName}</span>
                                        <span className="attachment-meta">
                                            Uploaded by {users.find(u => u.id === attachment.uploaderId)?.firstName || 'Unknown'} on {formatDate(attachment.uploadedAt, true)}
                                        </span>
                                    </div>
                                    <div className="attachment-actions">
                                        <a href={attachment.fileUrl} download={attachment.fileName} className="btn-icon-small" title="Download">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        </a>
                                        <button className="btn-icon-small" title="Delete" onClick={() => onDeleteAttachment(attachment.id)}>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                           <p className="no-attachments">No attachments.</p>
                        )}
                    </div>
                    <div className="add-attachment-form">
                        <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple style={{ display: 'none' }} />
                        <button className="btn btn-secondary" onClick={triggerFileUpload}>Upload Files</button>
                    </div>
                </div>

                <div className="comments-section">
                    <h3>Comments</h3>
                    <div className="add-comment-form">
                        <textarea
                            className="form-control"
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={e => setNewComment(e.target.value)}
                        />
                        <div className="add-comment-controls">
                           <p>Comments are plain text.</p>
                           <button className="btn btn-secondary" onClick={() => setNewComment('')}>Cancel</button>
                           <button className="btn btn-primary" onClick={handleAddComment}>Comment</button>
                        </div>
                    </div>
                    <div className="comment-list">
                         {taskComments.length > 0 ? (
                            taskComments.map(comment => (
                                <div key={comment.id} className="comment">
                                    <div className="comment-meta">
                                        <span className="comment-author">{users.find(u => u.id === comment.authorId)?.firstName || 'Unknown'}</span>
                                        <span className="comment-timestamp">{formatDate(comment.timestamp, true)}</span>
                                    </div>
                                    <p>{comment.content}</p>
                                </div>
                            ))
                        ) : (
                           <p className="no-comments">No comments yet.</p>
                        )}
                    </div>
                </div>
            </>
        )}
        
        <div className="modal-footer">
            <div>
              {isEditing && (
                <button className="btn btn-danger" onClick={() => onDelete(task!.id!)}>
                  Delete Task
                </button>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {isEditing ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
};

const UserProfileModal = ({
  isOpen,
  onClose,
  onSave,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User) => void;
  user: User | null;
}) => {
  const [formData, setFormData] = useState<Partial<User>>({});

  useEffect(() => {
    if (user) {
      setFormData({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave({
      ...user,
      firstName: formData.firstName || user.firstName,
      lastName: formData.lastName || user.lastName,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My Profile</h2>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
        <div className="form-grid">
            <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    className="form-control"
                    value={formData.firstName || ''}
                    onChange={handleChange}
                />
            </div>
            <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    className="form-control"
                    value={formData.lastName || ''}
                    onChange={handleChange}
                />
            </div>
        </div>
        <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                value={user.email}
                disabled
            />
        </div>
        <div className="modal-footer">
            <div/>
            <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
        </div>
      </div>
    </div>
  );
};


const ProjectSettingsModal = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    project,
    users,
    currentUser,
    onUpdateRequest,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Project) => void;
    onDelete: (projectId: string) => void;
    project: Project | null;
    users: User[];
    currentUser: User;
    onUpdateRequest: (projectId: string, userId: string, action: 'approve' | 'deny') => void;
}) => {
    const [formData, setFormData] = useState<Partial<Project>>({});
    const [members, setMembers] = useState<ProjectMember[]>([]);
    const [userToInvite, setUserToInvite] = useState('');
    
    const isCurrentUserAdmin = useMemo(() => project?.members.find(m => m.userId === currentUser.id)?.role === 'Admin', [project, currentUser.id]);

    useEffect(() => {
        if (project) {
            setFormData({ name: project.name, privacy: project.privacy });
            setMembers(project.members);
        }
    }, [project]);

    if (!isOpen || !project) return null;

    const handleSave = () => {
        onSave({ ...project, ...formData, members });
    };

    const handleRoleChange = (userId: string, newRole: ProjectRole) => {
        setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    };

    const handleRemoveMember = (userId: string) => {
        setMembers(prev => prev.filter(m => m.userId !== userId));
    };
    
    const handleAddMember = () => {
        if (userToInvite && !members.some(m => m.userId === userToInvite)) {
            setMembers(prev => [...prev, { userId: userToInvite, role: 'Member' }]);
            setUserToInvite('');
        }
    }
    
    const usersNotInProject = users.filter(u => !members.some(m => m.userId === u.id));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{project.name} Settings</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>

                <div className="form-group">
                    <label htmlFor="projectName">Project Name</label>
                    <input
                        type="text"
                        id="projectName"
                        name="name"
                        className="form-control"
                        value={formData.name || ''}
                        onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                        disabled={!isCurrentUserAdmin}
                    />
                </div>
                
                {isCurrentUserAdmin && (
                    <div className="form-group">
                        <label>Privacy</label>
                        <div className="privacy-options">
                            <label className="privacy-option">
                                <input type="radio" name="privacy" value="public" checked={formData.privacy === 'public'} onChange={e => setFormData(p => ({...p, privacy: 'public'}))} />
                                <div>
                                    <strong>Public</strong>
                                    <p className="privacy-option-description">Anyone can see and join this project.</p>
                                </div>
                            </label>
                            <label className="privacy-option">
                                <input type="radio" name="privacy" value="restricted" checked={formData.privacy === 'restricted'} onChange={e => setFormData(p => ({...p, privacy: 'restricted'}))} />
                                <div>
                                    <strong>Restricted</strong>
                                    <p className="privacy-option-description">Only invited members can see and join. Others can request to join.</p>
                                </div>
                            </label>
                        </div>
                    </div>
                )}
                
                {isCurrentUserAdmin && (project.joinRequests?.length ?? 0) > 0 && (
                     <div className="join-requests-section">
                        <h3>Join Requests</h3>
                        <div className="join-requests-list">
                            {project.joinRequests?.map(req => {
                                const user = users.find(u => u.id === req.userId);
                                return (
                                    <div key={req.userId} className="join-request-item">
                                        <span className="member-name">{user?.firstName} {user?.lastName}</span>
                                        <div className="join-request-actions">
                                            <button className="btn btn-sm btn-success" onClick={() => onUpdateRequest(project.id, req.userId, 'approve')}>Approve</button>
                                            <button className="btn btn-sm btn-danger" onClick={() => onUpdateRequest(project.id, req.userId, 'deny')}>Deny</button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <h3>Members</h3>
                     <div className="member-management-list">
                        {members.map(member => {
                           const user = users.find(u => u.id === member.userId);
                           const isCreator = project.members[0].userId === member.userId;
                           return (
                               <div key={member.userId} className="member-management-item">
                                   <span className="member-name">{user?.firstName} {user?.lastName}</span>
                                    {isCurrentUserAdmin && !isCreator ? (
                                       <>
                                           <select 
                                               className="form-control member-role-select" 
                                               value={member.role}
                                               onChange={(e) => handleRoleChange(member.userId, e.target.value as ProjectRole)}
                                           >
                                               <option value="Admin">Admin</option>
                                               <option value="Member">Member</option>
                                           </select>
                                           <button className="btn-icon-small" title="Remove Member" onClick={() => handleRemoveMember(member.userId)}>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                       </>
                                   ) : (
                                       <span className="member-role-display">{isCreator ? 'Creator' : member.role}</span>
                                   )}
                               </div>
                           )
                        })}
                    </div>
                </div>

                {isCurrentUserAdmin && (
                     <div className="add-member-section">
                        <h4>Invite Member</h4>
                        <div className="add-member-form">
                            <select className="form-control" value={userToInvite} onChange={e => setUserToInvite(e.target.value)}>
                                <option value="">Select a user...</option>
                                {usersNotInProject.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                            </select>
                            <button className="btn btn-primary" onClick={handleAddMember}>Add</button>
                        </div>
                    </div>
                )}

                <div className="modal-footer">
                    <div>
                        {isCurrentUserAdmin && (
                            <button className="btn btn-danger" onClick={() => onDelete(project.id)}>Delete Project</button>
                        )}
                    </div>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CreateProjectModal = ({
    isOpen,
    onClose,
    onSave,
    currentUser,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (project: Project) => void;
    currentUser: User;
}) => {
    const [name, setName] = useState('');
    const [privacy, setPrivacy] = useState<'public' | 'restricted'>('restricted');

    const handleSave = () => {
        if (!name.trim()) return;
        const newProject: Project = {
            id: `proj-${Date.now()}`,
            name,
            privacy,
            members: [{ userId: currentUser.id, role: 'Admin' }],
            joinRequests: [],
        };
        onSave(newProject);
        setName('');
        setPrivacy('restricted');
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Project</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>
                <div className="form-group">
                    <label htmlFor="newProjectName">Project Name</label>
                    <input
                        type="text"
                        id="newProjectName"
                        className="form-control"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g., Q4 Marketing Campaign"
                    />
                </div>
                 <div className="form-group">
                    <label>Privacy</label>
                    <div className="privacy-options">
                        <label className="privacy-option">
                            <input type="radio" name="newProjectPrivacy" value="public" checked={privacy === 'public'} onChange={() => setPrivacy('public')} />
                            <div>
                                <strong>Public</strong>
                                <p className="privacy-option-description">Anyone can see and join this project.</p>
                            </div>
                        </label>
                        <label className="privacy-option">
                            <input type="radio" name="newProjectPrivacy" value="restricted" checked={privacy === 'restricted'} onChange={() => setPrivacy('restricted')} />
                            <div>
                                <strong>Restricted</strong>
                                <p className="privacy-option-description">Only invited members can join. Others can request access.</p>
                            </div>
                        </label>
                    </div>
                </div>
                <div className="modal-footer">
                    <div/>
                    <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>Create Project</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const App = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [labels, setLabels] = useState<Label[]>([]);
    const [comments, setComments] = useState<Comment[]>([]);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [isProjectSettingsModalOpen, setIsProjectSettingsModalOpen] = useState(false);
    
    const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const [filters, setFilters] = useState({ searchTerm: '', assigneeId: 'all', status: 'all' });
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'dueDate', direction: 'ascending' });

    useEffect(() => {
        // Load data from localStorage or initialize
        const savedData = localStorage.getItem('anasa-data');
        if (savedData) {
            const data = JSON.parse(savedData);
            setUsers(data.users || initialUsers);
            setProjects(data.projects || initialProjects);
            setTasks(data.tasks || initialTasks);
            setLabels(data.labels || initialLabels);
            setComments(data.comments || initialComments);
            setAttachments(data.attachments || initialAttachments);
            const user = data.users.find((u: User) => u.id === 'user-1') || initialUsers[0];
            setCurrentUser(user);
            const firstUserProject = (data.projects || initialProjects).find((p: Project) => p.members.some(m => m.userId === user.id));
            if (firstUserProject) {
                setSelectedProjectId(firstUserProject.id);
            }
        } else {
            // Initialize with mock data
            setUsers(initialUsers);
            setProjects(initialProjects);
            setTasks(initialTasks);
            setLabels(initialLabels);
            setComments(initialComments);
            setAttachments(initialAttachments);
            const user = initialUsers[0];
            setCurrentUser(user);
            const firstUserProject = initialProjects.find(p => p.members.some(m => m.userId === user.id));
             if (firstUserProject) {
                setSelectedProjectId(firstUserProject.id);
            }
        }
    }, []);

    useEffect(() => {
        // Save data to localStorage whenever it changes
        if (users.length > 0) { // Avoid saving empty initial state
             const dataToSave = JSON.stringify({ users, projects, tasks, labels, comments, attachments });
             localStorage.setItem('anasa-data', dataToSave);
        }
    }, [users, projects, tasks, labels, comments, attachments]);

    const handleSaveTask = (taskToSave: Task) => {
        setTasks(prevTasks => {
            const taskExists = prevTasks.some(t => t.id === taskToSave.id);
            if (taskExists) {
                return prevTasks.map(t => t.id === taskToSave.id ? taskToSave : t);
            } else {
                return [...prevTasks, taskToSave];
            }
        });
        setIsTaskModalOpen(false);
        setEditingTask(null);
    };

    const handleDeleteTask = (taskId: string) => {
        setTasks(prevTasks => prevTasks.filter(t => t.id !== taskId));
        setIsTaskModalOpen(false);
        setEditingTask(null);
    };
    
    const handleEditTask = (task: Task) => {
        setEditingTask(task);
        setIsTaskModalOpen(true);
    };
    
    const handleNewTask = () => {
        setEditingTask(null);
        setIsTaskModalOpen(true);
    };
    
    const handleSaveProject = (projectToSave: Project) => {
        setProjects(prev => prev.map(p => p.id === projectToSave.id ? projectToSave : p));
        setIsProjectSettingsModalOpen(false);
        setEditingProject(null);
    };

    const handleCreateProject = (newProject: Project) => {
        setProjects(prev => [...prev, newProject]);
        setSelectedProjectId(newProject.id);
        setIsCreateProjectModalOpen(false);
    }
    
    const handleDeleteProject = (projectId: string) => {
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setTasks(prev => prev.filter(t => !t.projectIds.includes(projectId)));
        if (selectedProjectId === projectId) {
            setSelectedProjectId(projects[0]?.id || '');
        }
        setIsProjectSettingsModalOpen(false);
        setEditingProject(null);
    };

    const handleOpenProjectSettings = (projectId: string) => {
        const project = projects.find(p => p.id === projectId);
        if (project) {
            setEditingProject(project);
            setIsProjectSettingsModalOpen(true);
        }
    }
    
    const handleSaveProfile = (updatedUser: User) => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        if (currentUser && currentUser.id === updatedUser.id) {
            setCurrentUser(updatedUser);
        }
        setIsProfileModalOpen(false);
    };

    const handleJoinRequest = (projectId: string) => {
        if (!currentUser) return;
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const newRequests = [...(p.joinRequests || []), { userId: currentUser.id, timestamp: new Date().toISOString() }];
                return { ...p, joinRequests: newRequests };
            }
            return p;
        }))
    }
    
    const handleUpdateRequest = (projectId: string, userId: string, action: 'approve' | 'deny') => {
        setProjects(prev => prev.map(p => {
            if (p.id === projectId) {
                const updatedRequests = p.joinRequests?.filter(r => r.userId !== userId) || [];
                let updatedMembers = p.members;
                if (action === 'approve') {
                    updatedMembers = [...p.members, { userId, role: 'Member' }];
                }
                return { ...p, members: updatedMembers, joinRequests: updatedRequests };
            }
            return p;
        }));
    };
    
    const handleAddComment = (comment: { taskId: string; content: string; authorId: string }) => {
        const newComment: Comment = {
            id: `comment-${Date.now()}`,
            ...comment,
            timestamp: new Date().toISOString(),
        };
        setComments(prev => [...prev, newComment]);
    };
    
    const handleAddAttachment = (newAttachments: Omit<Attachment, 'id'>[]) => {
        const fullAttachments: Attachment[] = newAttachments.map(att => ({
            ...att,
            id: `att-${Date.now()}-${Math.random()}`,
        }));
        setAttachments(prev => [...prev, ...fullAttachments]);
    };
    
    const handleDeleteAttachment = (attachmentId: string) => {
        setAttachments(prev => prev.filter(att => att.id !== attachmentId));
    };


    const filteredTasks = useMemo(() => {
        return tasks
            .filter(task => task.projectIds.includes(selectedProjectId))
            .filter(task => {
                const searchTermMatch = task.title.toLowerCase().includes(filters.searchTerm.toLowerCase());
                const assigneeMatch = filters.assigneeId === 'all' || task.assigneeId === filters.assigneeId;
                const statusMatch = filters.status === 'all' || task.status === filters.status;
                return searchTermMatch && assigneeMatch && statusMatch;
            });
    }, [tasks, selectedProjectId, filters]);

    if (!currentUser) {
        return <div>Loading...</div>; // Or a proper login screen
    }

    const mainLayoutClasses = `main-layout ${isSidebarOpen ? 'sidebar-is-open' : ''}`;
    
    return (
        <>
            <div className={mainLayoutClasses}>
                 <ProjectList
                    projects={projects}
                    tasks={tasks}
                    selectedProjectId={selectedProjectId}
                    onSelectProject={setSelectedProjectId}
                    onNewProject={() => setIsCreateProjectModalOpen(true)}
                    currentUser={currentUser}
                    onLogout={() => console.log('logout')}
                    onEditTask={handleEditTask}
                    isSidebarOpen={isSidebarOpen}
                    onCloseSidebar={() => setIsSidebarOpen(false)}
                    onJoinRequest={handleJoinRequest}
                    onOpenProfile={() => setIsProfileModalOpen(true)}
                />
                <ProjectDetail
                    project={projects.find(p => p.id === selectedProjectId)}
                    tasks={filteredTasks}
                    users={users}
                    allTasks={tasks}
                    allLabels={labels}
                    filters={filters}
                    onFilterChange={(newFilters) => setFilters(prev => ({...prev, ...newFilters}))}
                    sortConfig={sortConfig}
                    onSortChange={setSortConfig}
                    onNewTask={handleNewTask}
                    onEditTask={handleEditTask}
                    onOpenProjectSettings={handleOpenProjectSettings}
                    onToggleSidebar={() => setIsSidebarOpen(true)}
                />
            </div>
            
             <TaskModal
                isOpen={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                onSave={handleSaveTask}
                onDelete={handleDeleteTask}
                onEditTask={handleEditTask}
                onAddComment={handleAddComment}
                onAddAttachment={handleAddAttachment}
                onDeleteAttachment={handleDeleteAttachment}
                task={editingTask}
                users={users}
                allTasks={tasks}
                allLabels={labels}
                memberProjects={projects.filter(p => p.members.some(m => m.userId === currentUser.id))}
                comments={comments}
                attachments={attachments}
                projectId={selectedProjectId}
                currentUser={currentUser}
            />
            
            <ProjectSettingsModal
                isOpen={isProjectSettingsModalOpen}
                onClose={() => setIsProjectSettingsModalOpen(false)}
                onSave={handleSaveProject}
                onDelete={handleDeleteProject}
                project={editingProject}
                users={users}
                currentUser={currentUser}
                onUpdateRequest={handleUpdateRequest}
            />

            <CreateProjectModal
                isOpen={isCreateProjectModalOpen}
                onClose={() => setIsCreateProjectModalOpen(false)}
                onSave={handleCreateProject}
                currentUser={currentUser}
            />
            
            <UserProfileModal 
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSave={handleSaveProfile}
                user={currentUser}
            />
        </>
    );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);