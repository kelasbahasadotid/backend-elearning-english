'use client';

import React from 'react';
import {
  RectangleStackIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ClipboardDocumentCheckIcon,
  ChatBubbleBottomCenterTextIcon,
  PaperClipIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  Bars3Icon
} from '@heroicons/react/24/solid';
import Swal from 'sweetalert2';
import { AdminCourse, QuizQuestion, SpeakingPrompt, ScalevPackage } from '../types';

interface CoursesTabProps {
  adminCourses: AdminCourse[];
  adminCategories: any[];
  activeSyllabusCourse: AdminCourse | null;
  syllabusData: any;
  activeQuizLessonId: number | null;
  activeQuizLesson: any;
  selectedQuizId: string;
  quizConfigForm: any;
  setQuizConfigForm: (val: any) => void;
  handleSaveQuizConfig: (e: React.FormEvent) => void;
  quizQuestions: QuizQuestion[];
  setQuizQuestions: (q: QuizQuestion[]) => void;
  currentQuestions: QuizQuestion[];
  questionsPage: number;
  setQuestionsPage: (p: number) => void;
  handleOpenEditQuestion: (q: QuizQuestion) => void;
  handleDeleteQuestion: (qId: number) => void;
  handleDeleteOption: (optionId: number) => void;
  setShowCreateQuestionModal: (val: boolean) => void;
  setQuestionForm: (val: any) => void;
  setOptionModalQuestion: (q: any) => void;
  setOptionForm: (val: any) => void;
  setShowCreateOptionModal: (val: boolean) => void;
  activeSpeakingLessonId: number | null;
  selectedSpeakingTestId: string;
  adminSpeakingList: any[];
  speakingConfigForm: any;
  setSpeakingConfigForm: (val: any) => void;
  handleSaveSpeakingConfig: (e: React.FormEvent) => void;
  speakingPrompts: SpeakingPrompt[];
  currentPrompts: SpeakingPrompt[];
  promptsPage: number;
  setPromptsPage: (p: number) => void;
  setShowCreatePromptModal: (val: boolean) => void;
  setPromptForm: (val: any) => void;
  handleOpenEditPrompt: (p: SpeakingPrompt) => void;
  handleDeletePrompt: (pId: number) => void;
  onManageSyllabus: (course: AdminCourse) => void;
  onOpenCreateCourseModal: () => void;
  onOpenEditCourse: (course: AdminCourse) => void;
  onDeleteCourse: (id: number) => void;
  onOpenCreateModule: () => void;
  onOpenEditModule: (m: any) => void;
  onDeleteModule: (mId: number) => void;
  onOpenCreateLesson: (moduleId: number) => void;
  onOpenEditLesson: (les: any, moduleId: number) => void;
  onDeleteLesson: (lessonId: number) => void;
  onOpenQuizEditor: (les: any) => void;
  onOpenSpeakingEditor: (les: any) => void;
  setContentManagerLesson: (les: any) => void;
  setActiveQuizLessonId: (id: number | null) => void;
  setActiveQuizLesson: (les: any) => void;
  setSelectedQuizId: (id: string) => void;
  setActiveSpeakingLessonId: (id: number | null) => void;
  setSelectedSpeakingTestId: (id: string) => void;
  renderPaginationNav: (currentPage: number, totalPages: number, setPage: (p: number) => void) => React.ReactNode;
  totalPages: (list: any[], size: number) => number;
  itemsPerPageDefault: number;
  adminQuizzesList: any[];
  api: any;
  locale: string;
}

export const CoursesTab: React.FC<CoursesTabProps> = ({
  adminCourses,
  adminCategories,
  activeSyllabusCourse,
  syllabusData,
  activeQuizLessonId,
  activeQuizLesson,
  selectedQuizId,
  quizConfigForm,
  setQuizConfigForm,
  handleSaveQuizConfig,
  quizQuestions,
  setQuizQuestions,
  currentQuestions,
  questionsPage,
  setQuestionsPage,
  handleOpenEditQuestion,
  handleDeleteQuestion,
  handleDeleteOption,
  setShowCreateQuestionModal,
  setQuestionForm,
  setOptionModalQuestion,
  setOptionForm,
  setShowCreateOptionModal,
  activeSpeakingLessonId,
  selectedSpeakingTestId,
  adminSpeakingList,
  speakingConfigForm,
  setSpeakingConfigForm,
  handleSaveSpeakingConfig,
  speakingPrompts,
  currentPrompts,
  promptsPage,
  setPromptsPage,
  setShowCreatePromptModal,
  setPromptForm,
  handleOpenEditPrompt,
  handleDeletePrompt,
  onManageSyllabus,
  onOpenCreateCourseModal,
  onOpenEditCourse,
  onDeleteCourse,
  onOpenCreateModule,
  onOpenEditModule,
  onDeleteModule,
  onOpenCreateLesson,
  onOpenEditLesson,
  onDeleteLesson,
  onOpenQuizEditor,
  onOpenSpeakingEditor,
  setContentManagerLesson,
  setActiveQuizLessonId,
  setActiveQuizLesson,
  setSelectedQuizId,
  setActiveSpeakingLessonId,
  setSelectedSpeakingTestId,
  renderPaginationNav,
  totalPages,
  itemsPerPageDefault = 10,
  adminQuizzesList,
  api,
  locale = 'id'
}) => {
  const [scalevPackages, setScalevPackages] = React.useState<ScalevPackage[]>([]);
  const [packagesLoading, setPackagesLoading] = React.useState(false);
  const [showPackageModal, setShowPackageModal] = React.useState(false);
  const [editingPackage, setEditingPackage] = React.useState<ScalevPackage | null>(null);
  const [packageForm, setPackageForm] = React.useState({
    packageName: '',
    keyword: '',
    accessDays: 365,
    durationLabel: '1 Tahun',
    status: 'ACTIVE'
  });

  const fetchScalevPackages = React.useCallback(async () => {
    if (!api) return;
    setPackagesLoading(true);
    try {
      const res = await api.get('/admin/scalev-packages');
      setScalevPackages(res.data || []);
    } catch (err) {
      console.warn('Failed to load scalev packages', err);
    } finally {
      setPackagesLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    fetchScalevPackages();
  }, [fetchScalevPackages]);

  const handleOpenCreatePackage = () => {
    setEditingPackage(null);
    setPackageForm({ packageName: '', keyword: '', accessDays: 365, durationLabel: '1 Tahun', status: 'ACTIVE' });
    setShowPackageModal(true);
  };

  const handleOpenEditPackage = (pkg: ScalevPackage) => {
    setEditingPackage(pkg);
    setPackageForm({
      packageName: pkg.package_name,
      keyword: pkg.keyword,
      accessDays: pkg.access_days,
      durationLabel: pkg.duration_label,
      status: pkg.status
    });
    setShowPackageModal(true);
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!api) return;
    try {
      if (editingPackage) {
        await api.put(`/admin/scalev-packages/${editingPackage.id}`, packageForm);
        Swal.fire({ icon: 'success', title: 'Paket Scalev Berhasil Diperbarui!', confirmButtonColor: '#EAB308' });
      } else {
        await api.post('/admin/scalev-packages', packageForm);
        Swal.fire({ icon: 'success', title: 'Paket Scalev Baru Berhasil Ditambahkan!', confirmButtonColor: '#EAB308' });
      }
      setShowPackageModal(false);
      await fetchScalevPackages();
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan Paket', text: err.response?.data?.error || err.message, confirmButtonColor: '#EAB308' });
    }
  };

  const handleDeletePackage = async (id: number) => {
    if (!api) return;
    const confirmResult = await Swal.fire({
      title: 'Hapus Aturan Paket ini?',
      text: 'Keyword pemetaan paket ini akan dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'Ya, Hapus'
    });
    if (!confirmResult.isConfirmed) return;
    try {
      await api.delete(`/admin/scalev-packages/${id}`);
      await fetchScalevPackages();
      Swal.fire({ icon: 'success', title: 'Paket Berhasil Dihapus!', confirmButtonColor: '#EAB308' });
    } catch (err: any) {
      Swal.fire({ icon: 'error', title: 'Gagal Menghapus Paket', confirmButtonColor: '#EAB308' });
    }
  };

  // Syllabus Reordering Handlers (Module & Lesson / Quiz Up & Down Shifts + Drag-and-Drop)
  const handleReorderModule = async (mIdx: number, direction: 'UP' | 'DOWN') => {
    if (!syllabusData?.modules || !api) return;
    const modules = [...syllabusData.modules];
    const targetIdx = direction === 'UP' ? mIdx - 1 : mIdx + 1;
    if (targetIdx < 0 || targetIdx >= modules.length) return;

    const m1 = modules[mIdx];
    const m2 = modules[targetIdx];

    try {
      await Promise.all([
        api.put(`/admin/modules/${m1.id}`, { moduleOrder: targetIdx + 1 }),
        api.put(`/admin/modules/${m2.id}`, { moduleOrder: mIdx + 1 })
      ]);
      if (activeSyllabusCourse) {
        onManageSyllabus(activeSyllabusCourse);
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui urutan modul' });
    }
  };

  const handleReorderLesson = async (mIdx: number, lesIdx: number, direction: 'UP' | 'DOWN') => {
    if (!syllabusData?.modules?.[mIdx]?.lessons || !api) return;
    const lessons = [...syllabusData.modules[mIdx].lessons];
    const targetIdx = direction === 'UP' ? lesIdx - 1 : lesIdx + 1;
    if (targetIdx < 0 || targetIdx >= lessons.length) return;

    const l1 = lessons[lesIdx];
    const l2 = lessons[targetIdx];

    try {
      await Promise.all([
        api.put(`/admin/lessons/${l1.id}`, { lessonOrder: targetIdx + 1 }),
        api.put(`/admin/lessons/${l2.id}`, { lessonOrder: lesIdx + 1 })
      ]);
      if (activeSyllabusCourse) {
        onManageSyllabus(activeSyllabusCourse);
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui urutan materi/quiz' });
    }
  };

  const handleDropModule = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || !syllabusData?.modules || !api) return;
    const modules = [...syllabusData.modules];
    const [moved] = modules.splice(fromIdx, 1);
    modules.splice(toIdx, 0, moved);

    try {
      await Promise.all(
        modules.map((mod: any, idx: number) =>
          api.put(`/admin/modules/${mod.id}`, { moduleOrder: idx + 1 })
        )
      );
      if (activeSyllabusCourse) {
        onManageSyllabus(activeSyllabusCourse);
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui urutan modul via drag-and-drop' });
    }
  };

  const handleDropLesson = async (mIdx: number, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx || !syllabusData?.modules?.[mIdx]?.lessons || !api) return;
    const lessons = [...syllabusData.modules[mIdx].lessons];
    const [moved] = lessons.splice(fromIdx, 1);
    lessons.splice(toIdx, 0, moved);

    try {
      await Promise.all(
        lessons.map((les: any, idx: number) =>
          api.put(`/admin/lessons/${les.id}`, { lessonOrder: idx + 1 })
        )
      );
      if (activeSyllabusCourse) {
        onManageSyllabus(activeSyllabusCourse);
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal', text: 'Gagal memperbarui urutan materi/quiz via drag-and-drop' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Quiz Editor View */}
      {activeQuizLessonId ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4 bg-foreground/5 p-4 rounded-xl border border-card-border justify-between">
            <button
              onClick={() => {
                setActiveQuizLessonId(null);
                setActiveQuizLesson(null);
                setSelectedQuizId('');
              }}
              className="text-xs font-black text-brand-blue-glow hover:underline flex items-center space-x-1 cursor-pointer bg-transparent border-0"
            >
              <span>← Back to Syllabus Builder</span>
            </button>
            <span className="text-xs font-black text-foreground flex items-center gap-2">
              {activeQuizLesson && (
                <span className="text-[9px] px-2 py-0.5 rounded font-black font-mono border bg-brand-yellow-medium/15 text-brand-yellow-medium border-brand-yellow-medium/30 whitespace-nowrap">
                  {activeQuizLesson.lesson_type}
                </span>
              )}
              {adminQuizzesList.find(q => String(q.id) === selectedQuizId)?.title || 'Assessment'}
            </span>
          </div>

          <form onSubmit={handleSaveQuizConfig} className="glass-card p-6 rounded-3xl border border-card-border space-y-4">
            <h4 className="text-xs font-black text-foreground uppercase tracking-wider text-brand-yellow-medium">Quiz / Exam Configuration</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Passing Score (%)</label>
                <input
                  type="number" required
                  value={quizConfigForm.passingScore}
                  onChange={(e) => setQuizConfigForm({ ...quizConfigForm, passingScore: parseInt(e.target.value) || 0 })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand-blue-glow"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Duration (Minutes)</label>
                <input
                  type="number" required
                  value={quizConfigForm.durationMinutes}
                  onChange={(e) => setQuizConfigForm({ ...quizConfigForm, durationMinutes: parseInt(e.target.value) || 0 })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand-blue-glow"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Max Attempts Allowed</label>
                <input
                  type="number" required
                  value={quizConfigForm.maxAttempt}
                  onChange={(e) => setQuizConfigForm({ ...quizConfigForm, maxAttempt: parseInt(e.target.value) || 0 })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand-blue-glow"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="bg-brand-blue-glow hover:bg-brand-blue-light text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-0">
                Save Configurations
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-base font-extrabold text-foreground">Questions in Quiz ({quizQuestions.length}):</h4>
                {quizQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {/* Question type breakdown badges */}
                    {[
                      { id: 1, label: '📝 MCQ',       color: 'bg-brand-blue-deep/15 text-brand-blue-glow border-brand-blue-glow/30' },
                      { id: 2, label: '☑️ Multi',     color: 'bg-purple-950/30 text-purple-400 border-purple-800/30' },
                      { id: 3, label: '✅ True/False', color: 'bg-emerald-950/30 text-emerald-400 border-emerald-800/30' },
                      { id: 4, label: '✏️ Fill Blank', color: 'bg-orange-950/30 text-orange-400 border-orange-800/30' },
                      { id: 6, label: '🔀 Ordering',  color: 'bg-pink-950/30 text-pink-400 border-pink-800/30' },
                    ].map(({ id, label, color }) => {
                      const count = quizQuestions.filter(q => q.question_type_id === id).length;
                      if (count === 0) return null;
                      return (
                        <span key={id} className={`text-[9px] px-2 py-0.5 rounded-full font-black border ${color}`}>
                          {label} ×{count}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setQuestionForm({ questionTypeId: 1, questionCode: '', questionText: '', point: 20, questionOrder: quizQuestions.length + 1 });
                  setShowCreateQuestionModal(true);
                }}
                className="bg-brand-yellow-medium hover:bg-brand-yellow-dark text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border-0 shadow-sm"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add Question</span>
              </button>
            </div>

            {quizQuestions.length === 0 ? (
              <p className="text-text-muted text-xs italic">No questions added to this quiz yet.</p>
            ) : (
              <div className="space-y-4">
                {currentQuestions.map(q => (
                  <div key={q.id} className="p-4 bg-card-bg border border-card-border rounded-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-card-border pb-2">
                      <span className="text-[10px] bg-brand-blue-deep/15 text-brand-blue-glow font-black border border-card-border px-2 py-0.5 rounded">
                        Type: {q.question_type_id === 2 ? 'MULTIPLE SELECT' : q.question_type_id === 3 ? 'TRUE & FALSE' : q.question_type_id === 4 ? 'FILL BLANK' : q.question_type_id === 6 ? 'ORDERING' : 'MULTIPLE CHOICE'} • Code: {q.question_code} • Order: {q.question_order} • Score: {q.point} pt
                      </span>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleOpenEditQuestion(q)} className="text-brand-yellow-medium hover:text-brand-yellow-dark p-1.5 rounded hover:bg-foreground/5 cursor-pointer border-0 bg-transparent">
                          <PencilIcon className="h-4.5 w-4.5" />
                        </button>
                        <button onClick={() => handleDeleteQuestion(q.id)} className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-foreground/5 cursor-pointer border-0 bg-transparent">
                          <TrashIcon className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <p className="text-xs font-bold text-foreground italic flex-1">"{q.question_text}"</p>
                      
                      {/* Question image upload */}
                      <label
                        title="Upload image for this question"
                        className={`cursor-pointer text-[9px] px-2 py-1 rounded border font-bold flex-shrink-0 transition-colors ${q.question_image ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/20' : 'border-card-border text-text-muted hover:text-brand-blue-glow hover:border-brand-blue-glow/50'}`}
                      >
                        {q.question_image ? '🖼 Q.Img ✓' : '🖼 Q.Img'}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB)'); return; }
                          const reader = new FileReader();
                          reader.onload = async () => {
                            try {
                              await api.put(`/admin/quizzes/questions/${q.id}/image`, { imageData: reader.result });
                              q.question_image = reader.result as string;
                              setQuizQuestions([...quizQuestions]);
                            } catch { alert('Failed to upload question image'); }
                          };
                          reader.readAsDataURL(file);
                          e.target.value = '';
                        }} />
                      </label>
                      {q.question_image && (
                        <button
                          onClick={async () => {
                            await api.put(`/admin/quizzes/questions/${q.id}/image`, { imageData: null });
                            q.question_image = null;
                            setQuizQuestions([...quizQuestions]);
                          }}
                          className="text-[9px] text-red-400 hover:underline cursor-pointer border-0 bg-transparent flex-shrink-0"
                        >
                          ✕img
                        </button>
                      )}
                    </div>

                    {q.question_image && (
                      <div className="mt-1">
                        <img src={q.question_image} alt="question" className="h-24 w-auto rounded-xl object-cover border border-card-border" />
                      </div>
                    )}

                    {/* Render Options list for this question */}
                    <div className="pl-4 border-l-2 border-brand-blue-glow/20 space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-text-muted uppercase block">
                          {q.question_type_id === 4 ? 'Correct Answers (Esai):' : q.question_type_id === 6 ? 'Correct Ordering Sequence:' : 'Options/Choices:'}
                        </span>
                        <button
                          onClick={() => {
                            setOptionModalQuestion(q);
                            setOptionForm({ optionLabel: 'A', optionText: '', isCorrect: false, score: 0 });
                            setShowCreateOptionModal(true);
                          }}
                          className="text-[10px] font-bold text-brand-blue-glow hover:underline cursor-pointer border-0 bg-transparent flex items-center space-x-1"
                        >
                          <PlusIcon className="h-3 w-3" />
                          <span>Add Choice</span>
                        </button>
                      </div>
                      
                      {q.options && q.options.length === 0 ? (
                        <p className="text-[10px] text-text-muted italic">No options added yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          {q.options?.map((opt: any) => (
                            <div key={opt.id} className="p-2 bg-foreground/5 rounded-xl border border-card-border flex flex-col gap-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center space-x-2">
                                  <span className={`text-[10px] font-mono font-black border px-1.5 py-0.5 rounded ${opt.is_correct ? 'bg-green-400/10 text-green-400 border-green-400/20' : 'bg-foreground/5 text-text-muted border-card-border'}`}>
                                    {opt.option_label}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-300">{opt.option_text}</span>
                                  {opt.is_correct && <span className="text-[9px] font-black text-green-400 uppercase font-bold">✓ Correct</span>}
                                </div>
                                <div className="flex items-center space-x-2">
                                  {/* Option image upload */}
                                  <label
                                    title="Upload image for this option"
                                    className={`cursor-pointer text-[9px] px-1.5 py-0.5 rounded border font-bold transition-colors ${opt.option_image ? 'border-emerald-500/50 text-emerald-400 bg-emerald-950/20' : 'border-card-border text-text-muted hover:text-brand-blue-glow hover:border-brand-blue-glow/50'}`}
                                  >
                                    {opt.option_image ? '🖼 Img ✓' : '🖼 Img'}
                                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (!file) return;
                                      if (file.size > 10 * 1024 * 1024) { alert('Image too large (max 10MB)'); return; }
                                      const reader = new FileReader();
                                      reader.onload = async () => {
                                        try {
                                          await api.put(`/admin/quizzes/questions/options/${opt.id}/image`, { imageData: reader.result });
                                          opt.option_image = reader.result as string;
                                          setQuizQuestions([...quizQuestions]);
                                        } catch { alert('Failed to upload option image'); }
                                      };
                                      reader.readAsDataURL(file);
                                      e.target.value = '';
                                    }} />
                                  </label>
                                  {opt.option_image && (
                                    <button
                                      title="Remove image"
                                      onClick={async () => {
                                        await api.put(`/admin/quizzes/questions/options/${opt.id}/image`, { imageData: null });
                                        opt.option_image = null;
                                        setQuizQuestions([...quizQuestions]);
                                      }}
                                      className="text-[9px] text-red-400 hover:underline cursor-pointer border-0 bg-transparent"
                                    >
                                      ✕
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteOption(opt.id)}
                                    className="text-red-400 hover:text-red-300 text-[10px] hover:underline cursor-pointer border-0 bg-transparent"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {/* Option image preview thumbnail */}
                              {opt.option_image && (
                                <div className="mt-1 pl-7">
                                  <img src={opt.option_image} alt="option img" className="h-16 w-auto rounded-lg object-cover border border-card-border" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {renderPaginationNav(questionsPage, totalPages(quizQuestions, itemsPerPageDefault), setQuestionsPage)}
              </div>
            )}
          </div>
        </div>
      ) : activeSpeakingLessonId ? (
        /* Speaking Editor View */
        <div className="space-y-4">
          <div className="flex items-center space-x-3 mb-4 bg-foreground/5 p-4 rounded-xl border border-card-border justify-between">
            <button
              onClick={() => {
                setActiveSpeakingLessonId(null);
                setSelectedSpeakingTestId('');
              }}
              className="text-xs font-black text-brand-blue-glow hover:underline flex items-center space-x-1 cursor-pointer bg-transparent border-0"
            >
              <span>← Back to Syllabus Builder</span>
            </button>
            <span className="text-xs font-black text-foreground">
              Speaking Test: <span className="text-brand-yellow-medium">{adminSpeakingList.find(t => String(t.id) === selectedSpeakingTestId)?.title || 'Speaking Test'}</span>
            </span>
          </div>

          {/* Speaking Configuration Panel */}
          <form onSubmit={handleSaveSpeakingConfig} className="glass-card p-6 rounded-3xl border border-card-border space-y-4">
            <h4 className="text-sm font-extrabold text-brand-yellow-medium uppercase tracking-wider">Speaking AI Configurations</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Passing Score (%)</label>
                <input
                  type="number" required min="0" max="100"
                  value={speakingConfigForm.passingScore}
                  onChange={(e) => setSpeakingConfigForm({ ...speakingConfigForm, passingScore: parseInt(e.target.value) || 0 })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand-blue-glow"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-muted uppercase mb-1">Max Attempts Allowed</label>
                <input
                  type="number" required min="0" placeholder="0 = Unlimited"
                  value={speakingConfigForm.maxAttempt}
                  onChange={(e) => setSpeakingConfigForm({ ...speakingConfigForm, maxAttempt: parseInt(e.target.value) || 0 })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none focus:border-brand-blue-glow"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="bg-brand-blue-glow hover:bg-brand-blue-light text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer border-0">
                Save Configurations
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-extrabold text-foreground">Speaking Prompts ({speakingPrompts.length}):</h4>
              <button
                onClick={() => {
                  setPromptForm({ promptType: 'READING', promptText: '', promptOrder: speakingPrompts.length + 1 });
                  setShowCreatePromptModal(true);
                }}
                className="bg-brand-blue-glow hover:bg-brand-blue-light text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border-0"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add Speaking Prompt</span>
              </button>
            </div>

            {speakingPrompts.length === 0 ? (
              <p className="text-text-muted text-xs italic">No speaking prompt sentences added yet.</p>
            ) : (
              <div className="space-y-4">
                {currentPrompts.map(p => (
                  <div key={p.id} className="p-4 bg-card-bg border border-card-border rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono font-black text-brand-yellow-medium">#{p.prompt_order} [{p.prompt_type}]</span>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleOpenEditPrompt(p)} className="text-brand-yellow-medium p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleDeletePrompt(p.id)} className="text-red-400 p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-bold text-foreground">"{p.prompt_text}"</p>
                  </div>
                ))}
                {renderPaginationNav(promptsPage, totalPages(speakingPrompts, itemsPerPageDefault), setPromptsPage)}
              </div>
            )}
          </div>
        </div>
      ) : activeSyllabusCourse ? (
        /* Syllabus Builder View */
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-card-border pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-brand-yellow-medium bg-brand-yellow-medium/10 px-2.5 py-1 rounded border border-brand-yellow-medium/30">
                Syllabus Editor
              </span>
              <h3 className="text-xl font-extrabold text-foreground mt-1">{activeSyllabusCourse.title}</h3>
            </div>
            <button
              onClick={onOpenCreateModule}
              className="bg-brand-yellow-medium hover:bg-brand-yellow-dark text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border-0 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Add Module</span>
            </button>
          </div>

          <div className="space-y-4">
            {syllabusData?.modules?.map((m: any, mIdx: number) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'MODULE', mIdx }));
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    if (data.type === 'MODULE') {
                      handleDropModule(data.mIdx, mIdx);
                    }
                  } catch (err) {}
                }}
                className="glass-card p-5 rounded-2xl border border-card-border space-y-4 relative group"
              >
                <div className="flex justify-between items-center border-b border-card-border pb-3">
                  <div className="flex items-center space-x-2">
                    {/* Drag Handle & Up/Down Buttons for Module Ordering */}
                    <div className="flex items-center space-x-1 mr-1">
                      <span className="cursor-grab active:cursor-grabbing text-text-muted hover:text-foreground p-0.5" title="Geser/Tarik Modul">
                        <Bars3Icon className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col space-y-0.5">
                        <button
                          type="button"
                          disabled={mIdx === 0}
                          onClick={() => handleReorderModule(mIdx, 'UP')}
                          className={`p-0.5 rounded border border-card-border ${
                            mIdx === 0 ? 'opacity-25 cursor-not-allowed text-gray-500' : 'hover:bg-brand-yellow-medium/20 text-brand-yellow-medium cursor-pointer'
                          }`}
                          title="Geser Modul ke Atas"
                        >
                          <ChevronUpIcon className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={mIdx === (syllabusData?.modules?.length || 1) - 1}
                          onClick={() => handleReorderModule(mIdx, 'DOWN')}
                          className={`p-0.5 rounded border border-card-border ${
                            mIdx === (syllabusData?.modules?.length || 1) - 1 ? 'opacity-25 cursor-not-allowed text-gray-500' : 'hover:bg-brand-yellow-medium/20 text-brand-yellow-medium cursor-pointer'
                          }`}
                          title="Geser Modul ke Bawah"
                        >
                          <ChevronDownIcon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <span className="text-xs font-black text-brand-yellow-medium">Module {mIdx + 1}:</span>
                    <h4 className="text-sm font-extrabold text-foreground">{m.title}</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button onClick={() => onOpenCreateLesson(m.id)} className="text-[10px] font-black px-2.5 py-1 bg-brand-blue-glow text-black rounded-lg hover:bg-brand-blue-light cursor-pointer border-0">
                      + Add Lesson / Quiz
                    </button>
                    <button onClick={() => onOpenEditModule(m)} className="text-brand-yellow-medium p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDeleteModule(m.id)} className="text-red-400 p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="pl-4 border-l-2 border-brand-yellow-medium/30 space-y-2">
                  {m.lessons?.length === 0 ? (
                    <p className="text-[11px] text-text-muted italic py-1">Belum ada materi atau quiz dalam modul ini. Klik "+ Add Lesson / Quiz" untuk menambahkan.</p>
                  ) : (
                    m.lessons?.map((les: any, lesIdx: number) => (
                      <div
                        key={les.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'LESSON', mIdx, lesIdx }));
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          try {
                            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                            if (data.type === 'LESSON' && data.mIdx === mIdx) {
                              handleDropLesson(mIdx, data.lesIdx, lesIdx);
                            }
                          } catch (err) {}
                        }}
                        className="p-3 bg-card-bg rounded-xl border border-card-border flex justify-between items-center hover:border-brand-yellow-medium/40 transition-all cursor-move"
                      >
                        <div className="flex items-center space-x-2">
                          {/* Drag Handle & Up/Down Buttons for Lesson/Quiz Ordering */}
                          <div className="flex items-center space-x-1 mr-1">
                            <span className="cursor-grab active:cursor-grabbing text-text-muted hover:text-foreground p-0.5" title="Geser/Tarik Materi atau Quiz">
                              <Bars3Icon className="h-3.5 w-3.5" />
                            </span>
                            <button
                              type="button"
                              disabled={lesIdx === 0}
                              onClick={() => handleReorderLesson(mIdx, lesIdx, 'UP')}
                              className={`p-1 rounded border border-card-border ${
                                lesIdx === 0 ? 'opacity-25 cursor-not-allowed text-gray-500' : 'hover:bg-brand-yellow-medium/20 text-brand-yellow-medium cursor-pointer'
                              }`}
                              title="Geser Materi/Quiz ke Atas"
                            >
                              <ChevronUpIcon className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={lesIdx === (m.lessons?.length || 1) - 1}
                              onClick={() => handleReorderLesson(mIdx, lesIdx, 'DOWN')}
                              className={`p-1 rounded border border-card-border ${
                                lesIdx === (m.lessons?.length || 1) - 1 ? 'opacity-25 cursor-not-allowed text-gray-500' : 'hover:bg-brand-yellow-medium/20 text-brand-yellow-medium cursor-pointer'
                              }`}
                              title="Geser Materi/Quiz ke Bawah"
                            >
                              <ChevronDownIcon className="h-3 w-3" />
                            </button>
                          </div>

                          <span className={`text-[9px] px-2 py-0.5 rounded font-black font-mono border ${
                            les.lesson_type === 'QUIZ' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            les.lesson_type === 'EXAM' ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                            les.lesson_type === 'SPEAKING' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' :
                            'bg-foreground/5 text-foreground border-card-border'
                          }`}>
                            {les.lesson_type === 'QUIZ' ? '📝 QUIZ' : les.lesson_type === 'EXAM' ? '🎓 EXAM' : les.lesson_type === 'SPEAKING' ? '🎙️ SPEAKING' : les.lesson_type}
                          </span>
                          <span className="text-xs font-bold text-foreground">{les.title}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => setContentManagerLesson(les)} className="text-[10px] font-black px-2 py-1 bg-emerald-700/80 text-white rounded-lg hover:bg-emerald-600 border-0 cursor-pointer">
                            Content
                          </button>
                          {(les.lesson_type === 'QUIZ' || les.lesson_type === 'EXAM') && (
                            <button onClick={() => onOpenQuizEditor(les)} className="text-[10px] font-black px-2 py-1 bg-brand-yellow-medium text-black rounded-lg hover:bg-brand-yellow-dark border-0 cursor-pointer">
                              Questions
                            </button>
                          )}
                          {les.lesson_type === 'SPEAKING' && (
                            <button onClick={() => onOpenSpeakingEditor(les)} className="text-[10px] font-black px-2 py-1 bg-brand-blue-glow text-black rounded-lg hover:bg-brand-blue-light border-0 cursor-pointer">
                              Prompts
                            </button>
                          )}
                          <button onClick={() => onOpenEditLesson(les, m.id)} className="text-brand-yellow-medium p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button onClick={() => onDeleteLesson(les.id)} className="text-red-400 p-1 rounded hover:bg-foreground/5 border-0 bg-transparent">
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Course Catalog List View */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xl font-extrabold text-foreground flex items-center space-x-2">
                <RectangleStackIcon className="h-6 w-6 text-brand-yellow-medium" />
                <span>{locale === 'id' ? 'Daftar & Katalog Kelas' : 'Course Catalog Management'}</span>
              </h3>
              <p className="text-xs text-text-muted mt-1">
                {locale === 'id'
                  ? 'Kelola daftar kelas, tingkat CEFR, modul silabus, dan materi pembelajaran.'
                  : 'Manage courses, CEFR levels, syllabus modules, and lesson contents.'}
              </p>
            </div>
            <button
              onClick={onOpenCreateCourseModal}
              className="bg-brand-yellow-medium hover:bg-brand-yellow-dark text-black px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border-0 shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>{locale === 'id' ? 'Tambah Kelas Baru' : 'Create Course'}</span>
            </button>
          </div>

          {/* INTERACTIVE SCALEV AUTOMATED PACKAGE TRIGGER MANAGER */}
          <div className="bg-brand-blue-deep/20 border border-brand-blue-glow/30 p-5 rounded-3xl space-y-3 text-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-card-border pb-3">
              <div>
                <span className="font-extrabold text-brand-blue-glow uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  ⚡ Pengaturan Dosis Paket & Durasi Akses Scalev (Trigger Keyword Produk)
                </span>
                <p className="text-text-muted text-[11px] mt-0.5">
                  Kelola dan sesuaikan kata kunci produk Scalev serta jumlah hari akses kelas yang otomatis diberikan ke siswa.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreatePackage}
                className="bg-brand-yellow-medium hover:bg-brand-yellow-dark text-black px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center space-x-1 cursor-pointer border-0 shadow-sm shrink-0"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Tambah Aturan Paket</span>
              </button>
            </div>

            {packagesLoading ? (
              <p className="text-text-muted text-xs italic">Loading aturan paket Scalev...</p>
            ) : scalevPackages.length === 0 ? (
              <p className="text-text-muted text-xs italic">Belum ada paket Scalev kustom yang dikonfigurasi.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                {scalevPackages.map((pkg) => (
                  <div key={pkg.id} className="bg-card-bg/90 p-3.5 rounded-2xl border border-card-border flex flex-col justify-between space-y-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-foreground text-[12px]">📦 {pkg.package_name}</span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${pkg.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                          {pkg.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-text-muted">
                        <b>Keyword Match:</b> <code className="text-brand-yellow-medium bg-brand-yellow-medium/10 px-1 py-0.5 rounded border border-brand-yellow-medium/20">{pkg.keyword}</code>
                      </div>
                      <div className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                        <span>🕒 Masa Aktif:</span>
                        <span>{pkg.duration_label} ({pkg.access_days} Hari)</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-card-border">
                      <button
                        type="button"
                        onClick={() => handleOpenEditPackage(pkg)}
                        className="text-brand-yellow-medium hover:text-brand-yellow-dark p-1 rounded hover:bg-foreground/5 cursor-pointer border-0 bg-transparent"
                        title="Edit Paket"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePackage(pkg.id)}
                        className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-foreground/5 cursor-pointer border-0 bg-transparent"
                        title="Hapus Paket"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {adminCourses.map((c) => (
              <div key={c.id} className="glass-card p-6 rounded-3xl border border-card-border flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-brand-yellow-medium bg-brand-yellow-medium/10 border border-brand-yellow-medium/30 px-2.5 py-0.5 rounded">
                      CEFR {c.cefr_level || 'A1'}
                    </span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                      c.status === 'PUBLISHED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <h4 className="text-base font-extrabold text-foreground">{c.title}</h4>
                  <p className="text-xs font-bold text-brand-yellow-medium line-clamp-2 notranslate" translate="no">
                    📌 {c.short_description || 'Ringkasan materi kelas.'}
                  </p>
                  <div className="pt-2 border-t border-card-border/60 space-y-1">
                    <span className="text-[10px] font-black uppercase text-text-muted block">Deskripsi Lengkap Kelas:</span>
                    <p className="text-xs text-text-muted line-clamp-3 leading-relaxed whitespace-pre-line notranslate" translate="no">
                      {c.description || 'Deskripsi lengkap kelas belum diisi.'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 pt-3 border-t border-card-border">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-brand-yellow-medium text-sm">Rp {Number(c.price).toLocaleString('id-ID')}</span>
                    <div className="flex items-center space-x-1">
                      <button onClick={() => onOpenEditCourse(c)} className="text-brand-yellow-medium p-1.5 rounded hover:bg-foreground/5 border-0 bg-transparent">
                        <PencilIcon className="h-4.5 w-4.5" />
                      </button>
                      <button onClick={() => onDeleteCourse(c.id)} className="text-red-400 p-1.5 rounded hover:bg-foreground/5 border-0 bg-transparent">
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => onManageSyllabus(c)}
                    className="w-full py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground font-bold text-xs rounded-xl transition-colors border border-card-border cursor-pointer"
                  >
                    Manage Syllabus Builder →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* MODAL EDIT / TAMBAH PAKET SCALEV */}
      {showPackageModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-3xl border border-card-border space-y-4">
            <div className="border-b border-card-border pb-3 flex justify-between items-center">
              <h3 className="text-base font-extrabold text-foreground flex items-center space-x-1.5">
                <RectangleStackIcon className="h-5 w-5 text-brand-yellow-medium" />
                <span>{editingPackage ? 'Edit Aturan Paket Scalev' : 'Tambah Aturan Paket Scalev'}</span>
              </h3>
              <button onClick={() => setShowPackageModal(false)} className="text-text-muted hover:text-foreground text-xs font-black p-1 border-0 bg-transparent cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleSavePackage} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Nama Paket</label>
                <input
                  type="text" required
                  value={packageForm.packageName}
                  onChange={(e) => setPackageForm({ ...packageForm, packageName: e.target.value })}
                  placeholder="Contoh: Paket 1 E-learning + TOEFL"
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Trigger Keyword (Pisahkan dengan Koma)
                </label>
                <input
                  type="text" required
                  value={packageForm.keyword}
                  onChange={(e) => setPackageForm({ ...packageForm, keyword: e.target.value })}
                  placeholder="paket 1, paket1, 3 bulan, 3m"
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none font-mono"
                />
                <p className="text-[10px] text-text-muted mt-1 italic">
                  Sistem akan mencocokkan kata kunci ini dengan judul produk pesanan dari Scalev.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Durasi Akses (Hari)</label>
                  <input
                    type="number" required min={1}
                    value={packageForm.accessDays}
                    onChange={(e) => {
                      const days = parseInt(e.target.value) || 30;
                      let label = `${days} Hari`;
                      if (days === 90) label = '3 Bulan';
                      if (days === 180) label = '6 Bulan';
                      if (days === 365) label = '1 Tahun';
                      setPackageForm({ ...packageForm, accessDays: days, durationLabel: label });
                    }}
                    className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">Label Durasi</label>
                  <input
                    type="text" required
                    value={packageForm.durationLabel}
                    onChange={(e) => setPackageForm({ ...packageForm, durationLabel: e.target.value })}
                    placeholder="3 Bulan / 1 Tahun"
                    className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">Status</label>
                <select
                  value={packageForm.status}
                  onChange={(e) => setPackageForm({ ...packageForm, status: e.target.value as any })}
                  className="w-full py-1.5 px-3 bg-card-bg border border-card-border rounded-lg text-xs text-foreground focus:outline-none font-bold"
                >
                  <option value="ACTIVE">ACTIVE (Aktif)</option>
                  <option value="INACTIVE">INACTIVE (Nonaktif)</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-3 border-t border-card-border">
                <button type="button" onClick={() => setShowPackageModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-foreground text-xs font-bold rounded-lg cursor-pointer border-0">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-brand-yellow-medium hover:bg-brand-yellow-dark text-black text-xs font-black rounded-lg cursor-pointer border-0">
                  {editingPackage ? 'Simpan Perubahan' : 'Tambah Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
