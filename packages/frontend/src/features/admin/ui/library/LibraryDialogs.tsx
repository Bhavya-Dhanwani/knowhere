import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { Modal } from '../../../../shared/ui/Modal';
import { Input } from '../../../../shared/ui/Input';
import { Button } from '../../../../shared/ui/Button';
import { ProgressBar } from '../../../../shared/ui/ProgressBar';
import { cn } from '../../../../shared/lib/cn';
import { FormError } from '../../../auth/ui/AuthControls';
import {
  contentApi,
  ItemType,
  Library,
  LibraryType,
  ResourceType
} from '../../../course/api/contentApi';
import { ITEM_META } from '../../../course/ui/itemMeta';
import { AttachResources, OrderedPicker } from './pickers';

export const libraryKey = ['course-library'];

const textarea =
  'w-full rounded-xl bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-xs ring-1 ring-inset ring-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500';

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children
}) => (
  <div>
    <p className="mb-1.5 text-[13px] font-medium text-zinc-700">{label}</p>
    {children}
    {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
  </div>
);

type Difficulty = 'easy' | 'medium' | 'hard';

const PointsInput: React.FC<{ value: number; onChange: (n: number) => void }> = ({
  value,
  onChange
}) => (
  <Input
    label="Points"
    type="number"
    min={0}
    max={1000}
    value={value}
    onChange={(e) => onChange(Math.min(1000, Math.max(0, Math.round(Number(e.target.value) || 0))))}
    containerClassName="w-32"
  />
);
const DifficultyPicker: React.FC<{ value: Difficulty; onChange: (d: Difficulty) => void }> = ({
  value,
  onChange
}) => (
  <div className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-100 p-1">
    {(['easy', 'medium', 'hard'] as const).map((d) => (
      <button
        key={d}
        type="button"
        onClick={() => onChange(d)}
        className={cn(
          'h-8 rounded-lg text-xs font-medium capitalize transition',
          value === d ? 'bg-white text-zinc-900 shadow-card' : 'text-zinc-500'
        )}
      >
        {d}
      </button>
    ))}
  </div>
);

interface DialogProps {
  open: boolean;
  onClose: () => void;
  // set to edit an existing item instead of creating one
  editId?: string | null;
}

// loads the full document for editing and hands it to `fill` (null = blank create form) per open
function useEditDoc<T>(
  type: LibraryType,
  open: boolean,
  editId: string | null | undefined,
  fill: (doc: T | null) => void
) {
  const q = useQuery({
    queryKey: ['library-edit', type, editId],
    queryFn: () => contentApi.getForEdit<T>(type, editId!),
    enabled: open && Boolean(editId),
    staleTime: 0,
    gcTime: 0
  });
  useEffect(() => {
    if (!open) return;
    if (!editId) fill(null);
    else if (q.data) fill(q.data);
  }, [open, editId, q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return q;
}

// shared submit plumbing: run, refresh the library, close
function useSave(fn: () => Promise<unknown>, onClose: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: libraryKey });
      onClose();
    }
  });
}

const Footer: React.FC<{
  onClose: () => void;
  onSave: () => void;
  valid: boolean;
  pending: boolean;
  label: string;
}> = ({ onClose, onSave, valid, pending, label }) => (
  <>
    <Button variant="outline" onClick={onClose}>
      Cancel
    </Button>
    <Button disabled={!valid} isLoading={pending} onClick={onSave}>
      {label}
    </Button>
  </>
);

/* ------------------------------------------------------------- resource */

const guessType = (f: File): ResourceType => {
  if (f.type.startsWith('video/')) return 'video';
  if (f.type.startsWith('image/')) return 'image';
  if (f.type === 'application/pdf') return 'pdf';
  if (/sheet|excel|csv/.test(f.type) || /\.(xlsx?|csv)$/i.test(f.name)) return 'xlsx';
  if (/word/.test(f.type) || /\.docx?$/i.test(f.name)) return 'docx';
  return 'resource';
};

export const UploadResourceDialog: React.FC<DialogProps> = ({ open, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState(0);
  const close = () => {
    setFile(null);
    setPct(0);
    onClose();
  };
  const save = useSave(() => contentApi.uploadResource(file!, guessType(file!), setPct), close);

  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Upload resource"
      description="Videos, PDFs, spreadsheets, docs or images. Uploaded straight to S3; videos then go through DRM."
      maxWidth="lg"
      footer={
        <Footer
          onClose={close}
          onSave={() => save.mutate()}
          valid={Boolean(file)}
          pending={save.isPending}
          label="Upload"
        />
      }
    >
      <div className="space-y-4">
        <FormError message={save.error instanceof Error ? save.error.message : null} />
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50/40">
          <Upload className="h-5 w-5 text-zinc-400" />
          <span className="max-w-full truncate text-sm text-zinc-700">
            {file ? file.name : 'Choose a file'}
          </span>
          {file ? (
            <span className="text-xs text-zinc-500">Detected as {guessType(file)}</span>
          ) : null}
          <input
            type="file"
            className="sr-only"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>
        {save.isPending ? <ProgressBar value={pct} showLabel /> : null}
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ MCQ */

type McqDoc = {
  question: string;
  questionResourceIds: string[];
  options: { text: string; resourceIds: string[] }[];
  correctOptionIndex: number;
  explanation: string;
  explanationResourceIds: string[];
  difficulty: Difficulty;
  points: number;
};

export const McqDialog: React.FC<DialogProps & { resources: Library['resources'] }> = ({
  open,
  onClose,
  resources,
  editId
}) => {
  const [question, setQuestion] = useState('');
  const [qFiles, setQFiles] = useState<string[]>([]);
  const [options, setOptions] = useState(
    Array.from({ length: 4 }, () => ({ text: '', files: [] as string[] }))
  );
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [eFiles, setEFiles] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [points, setPoints] = useState(10);

  const doc = useEditDoc<McqDoc>('mcq', open, editId, (d) => {
    setQuestion(d?.question || '');
    setQFiles((d?.questionResourceIds || []).map(String));
    setOptions(
      d
        ? d.options.map((o) => ({ text: o.text, files: (o.resourceIds || []).map(String) }))
        : Array.from({ length: 4 }, () => ({ text: '', files: [] }))
    );
    setCorrect(d?.correctOptionIndex ?? 0);
    setExplanation(d?.explanation || '');
    setEFiles((d?.explanationResourceIds || []).map(String));
    setDifficulty(d?.difficulty || 'easy');
    setPoints(d?.points ?? 10);
  });

  const save = useSave(() => {
    const body = {
      points,
      question: question.trim(),
      questionResourceIds: qFiles,
      options: options.map((o) => ({ text: o.text.trim(), resourceIds: o.files })),
      correctOptionIndex: correct,
      explanation: explanation.trim(),
      explanationResourceIds: eFiles,
      difficulty
    };
    return editId ? contentApi.update('mcq', editId, body) : contentApi.createMcq(body);
  }, onClose);
  const valid = Boolean(
    question.trim() && explanation.trim() && options.every((o) => o.text.trim())
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editId ? 'Edit MCQ' : 'New MCQ'}
      maxWidth="2xl"
      footer={
        <Footer
          onClose={onClose}
          onSave={() => save.mutate()}
          valid={valid && !doc.isFetching}
          pending={save.isPending}
          label={editId ? 'Save changes' : 'Create MCQ'}
        />
      }
    >
      <div className="space-y-5">
        <FormError message={(save.error || doc.error)?.message} />
        <Field label="Question">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            className={textarea}
          />
          <div className="mt-2">
            <AttachResources resources={resources} value={qFiles} onChange={setQFiles} />
          </div>
        </Field>
        <Field label="Options" hint="Tap the letter to mark the correct answer.">
          <div className="space-y-3">
            {options.map((o, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCorrect(i)}
                    aria-label={`Mark option ${String.fromCharCode(65 + i)} correct`}
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-semibold ring-1 ring-inset transition',
                      correct === i
                        ? 'bg-emerald-500 text-white ring-emerald-500'
                        : 'text-zinc-500 ring-zinc-200'
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </button>
                  <Input
                    value={o.text}
                    onChange={(e) =>
                      setOptions((p) =>
                        p.map((x, j) => (j === i ? { ...x, text: e.target.value } : x))
                      )
                    }
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  />
                </div>
                <div className="pl-11">
                  <AttachResources
                    resources={resources}
                    value={o.files}
                    onChange={(files) =>
                      setOptions((p) => p.map((x, j) => (j === i ? { ...x, files } : x)))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </Field>
        <Field label="Why it's correct">
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={2}
            className={textarea}
          />
          <div className="mt-2">
            <AttachResources resources={resources} value={eFiles} onChange={setEFiles} />
          </div>
        </Field>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <Field label="Difficulty">
              <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            </Field>
          </div>
          <PointsInput value={points} onChange={setPoints} />
        </div>
      </div>
    </Modal>
  );
};

/* --------------------------------------------------------- code question */

type Pair = { input: string; output: string };
const PairRows: React.FC<{
  rows: Pair[];
  onChange: (r: Pair[]) => void;
  max: number;
  noun: string;
}> = ({ rows, onChange, max, noun }) => (
  <div className="space-y-2">
    {rows.map((r, i) => (
      <div key={i} className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
          {(['input', 'output'] as const).map((k) => (
            <textarea
              key={k}
              value={r[k]}
              placeholder={k === 'input' ? 'input (stdin)' : 'expected output'}
              rows={2}
              onChange={(e) =>
                onChange(rows.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))
              }
              className={cn(textarea, 'font-mono text-[13px]')}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange(rows.filter((_, j) => j !== i))}
          className="mt-2 text-zinc-400 hover:text-red-600"
          aria-label={`Remove ${noun}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    ))}
    {rows.length < max ? (
      <Button
        size="sm"
        variant="outline"
        type="button"
        onClick={() => onChange([...rows, { input: '', output: '' }])}
      >
        <Plus className="h-3.5 w-3.5" /> Add {noun}
      </Button>
    ) : null}
  </div>
);

type CodeDoc = {
  title: string;
  description: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: Pair[];
  testCases: { input: string; expectedOutput: string }[];
  difficulty: Difficulty;
  supportedLanguages: string[];
  points: number;
  referenceSolution: { language: string; code: string } | null;
};

const CODE_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'cpp', label: 'C++' },
  { id: 'java', label: 'Java' }
];
const ALL_LANGUAGES = CODE_LANGUAGES.map((l) => l.id);

export const CodeQuestionDialog: React.FC<DialogProps> = ({ open, onClose, editId }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputFormat, setInputFormat] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [constraints, setConstraints] = useState('');
  const [examples, setExamples] = useState<Pair[]>([{ input: '', output: '' }]);
  const [tests, setTests] = useState<Pair[]>([]);
  const [generate, setGenerate] = useState(true);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');

  const [langs, setLangs] = useState<string[]>(ALL_LANGUAGES);
  const [points, setPoints] = useState(10);
  const [refLang, setRefLang] = useState('python');
  const [refCode, setRefCode] = useState('');

  const doc = useEditDoc<CodeDoc>('code-question', open, editId, (d) => {
    setLangs(d?.supportedLanguages?.filter((l) => ALL_LANGUAGES.includes(l)) || ALL_LANGUAGES);
    setPoints(d?.points ?? 10);
    setRefLang(d?.referenceSolution?.language || 'python');
    setRefCode(d?.referenceSolution?.code || '');
    setTitle(d?.title || '');
    setDescription(d?.description || '');
    setInputFormat(d?.inputFormat || '');
    setOutputFormat(d?.outputFormat || '');
    setConstraints((d?.constraints || []).join('\n'));
    setExamples(
      d
        ? d.examples.map((e) => ({ input: e.input, output: e.output }))
        : [{ input: '', output: '' }]
    );
    setTests(d ? d.testCases.map((t) => ({ input: t.input, output: t.expectedOutput })) : []);
    setGenerate(!d);
    setDifficulty(d?.difficulty || 'easy');
  });

  const filled = (rows: Pair[]) => rows.filter((r) => r.input.trim() && r.output.trim());
  const save = useSave(() => {
    const body = {
      title: title.trim(),
      description: description.trim(),
      inputFormat: inputFormat.trim(),
      outputFormat: outputFormat.trim(),
      constraints: constraints
        .split('\n')
        .map((c) => c.trim())
        .filter(Boolean),
      examples: filled(examples),
      testCases: filled(tests).map((t) => ({ input: t.input, expectedOutput: t.output })),
      difficulty,
      supportedLanguages: langs,
      points,
      referenceSolution: refCode.trim() ? { language: refLang, code: refCode } : null
    };
    return editId
      ? contentApi.update('code-question', editId, body)
      : contentApi.createCodeQuestion({ ...body, generateTests: generate });
  }, onClose);

  const valid = Boolean(
    title.trim() &&
    description.trim() &&
    inputFormat.trim() &&
    outputFormat.trim() &&
    filled(examples).length &&
    langs.length &&
    // generated tests take their expected output from the reference solution
    (!generate || editId || refCode.trim())
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editId ? 'Edit coding question' : 'New coding question'}
      maxWidth="3xl"
      footer={
        <Footer
          onClose={onClose}
          onSave={() => save.mutate()}
          valid={valid && !doc.isFetching}
          pending={save.isPending}
          label={editId ? 'Save changes' : 'Create question'}
        />
      }
    >
      <div className="space-y-5">
        <FormError message={(save.error || doc.error)?.message} />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Two Sum"
        />
        <Field label="Description" hint="Markdown supported.">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            className={textarea}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Input format">
            <textarea
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
              rows={2}
              className={textarea}
            />
          </Field>
          <Field label="Output format">
            <textarea
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              rows={2}
              className={textarea}
            />
          </Field>
        </div>
        <Field label="Constraints" hint="One per line.">
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            rows={2}
            className={cn(textarea, 'font-mono text-[13px]')}
          />
        </Field>
        <Field
          label="Languages"
          hint="JavaScript defines solve(input); Python, C++ and Java read stdin and print to stdout. Test cases are shared."
        >
          <div className="flex flex-wrap gap-2">
            {CODE_LANGUAGES.map((l) => {
              const on = langs.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setLangs((cur) => (on ? cur.filter((x) => x !== l.id) : [...cur, l.id]))
                  }
                  className={cn(
                    'h-8 rounded-lg px-3 text-xs font-medium ring-1 ring-inset transition',
                    on
                      ? 'bg-ink text-white ring-ink'
                      : 'text-zinc-600 ring-zinc-200 hover:ring-zinc-300'
                  )}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Examples (public, up to 5)">
          <PairRows rows={examples} onChange={setExamples} max={5} noun="example" />
        </Field>
        <Field
          label={`Hidden test cases (${filled(tests).length}/100)`}
          hint="Optional — write your own; AI can fill the rest."
        >
          <PairRows rows={tests} onChange={setTests} max={100} noun="test case" />
        </Field>
        <label
          className={cn(
            'flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50/50 p-3.5 ring-1 ring-inset ring-brand-200/70',
            editId && 'hidden'
          )}
        >
          <input
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-brand-600"
          />
          <span>
            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-900">
              <Sparkles className="h-3.5 w-3.5 text-brand-600" /> Auto-generate test cases up to 100
            </span>
            <span className="text-xs text-zinc-500">
              Mistral proposes inputs; every expected output comes from running your reference
              solution in the sandbox, after it passes the public examples.
            </span>
          </span>
        </label>
        <Field
          label={`Reference solution${generate && !editId ? '' : ' (optional)'}`}
          hint="Never shown to learners. Required to auto-generate tests."
        >
          <div className="space-y-2">
            <select
              value={refLang}
              onChange={(e) => setRefLang(e.target.value)}
              aria-label="Reference solution language"
              className="h-9 rounded-lg bg-zinc-100 px-2 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CODE_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <textarea
              value={refCode}
              onChange={(e) => setRefCode(e.target.value)}
              rows={8}
              spellCheck={false}
              placeholder={
                refLang === 'javascript'
                  ? 'function solve(input) { … }'
                  : 'Reads stdin, prints the answer'
              }
              className={cn(textarea, 'font-mono text-[13px]')}
            />
          </div>
        </Field>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <Field label="Difficulty">
              <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            </Field>
          </div>
          <PointsInput value={points} onChange={setPoints} />
        </div>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------ submodule */

type SubmoduleDoc = {
  title: string;
  description: string;
  content: {
    type: ItemType;
    resourceId?: string | null;
    contentId?: string | null;
    order: number;
  }[];
};

export const SubmoduleDialog: React.FC<DialogProps & { library?: Library }> = ({
  open,
  onClose,
  library,
  editId
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  const doc = useEditDoc<SubmoduleDoc>('submodule', open, editId, (d) => {
    setTitle(d?.title || '');
    setDescription(d?.description || '');
    setPicked(
      [...(d?.content || [])]
        .sort((a, b) => a.order - b.order)
        .map((c) => `${c.type}:${c.resourceId || c.contentId}`)
    );
  });

  // one list for everything; the key encodes the type so order is kept across types
  const icon = (t: ItemType) => {
    const M = ITEM_META[t];
    return (
      <span className={cn('grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset', M.tint)}>
        <M.icon className="h-3.5 w-3.5" />
      </span>
    );
  };
  const options = [
    ...(library?.resources || []).map((r) => {
      const t: ItemType = r.resourceType === 'video' ? 'video' : 'resource';
      return {
        id: `${t}:${r._id}`,
        label: r.fileName,
        sublabel: `${ITEM_META[t].label} · ${r.status.toLowerCase().replace('_', ' ')}`,
        icon: icon(t)
      };
    }),
    ...(library?.mcqs || []).map((q) => ({
      id: `mcq:${q._id}`,
      label: q.question,
      sublabel: `Quiz · ${q.difficulty}`,
      icon: icon('mcq')
    })),
    ...(library?.codeQuestions || []).map((q) => ({
      id: `code-question:${q._id}`,
      label: q.title,
      sublabel: `Coding · ${q.difficulty}`,
      icon: icon('code-question')
    }))
  ];

  const save = useSave(() => {
    const body = {
      title: title.trim(),
      description: description.trim(),
      content: picked.map((key) => {
        const [type, id] = key.split(':') as [ItemType, string];
        return type === 'video' || type === 'resource'
          ? { type, resourceId: id }
          : { type, contentId: id };
      })
    };
    return editId ? contentApi.update('submodule', editId, body) : contentApi.createSubmodule(body);
  }, onClose);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editId ? 'Edit submodule' : 'New submodule'}
      description="A lesson made of files, videos, quizzes and coding questions — in the order you pick them."
      maxWidth="2xl"
      footer={
        <Footer
          onClose={onClose}
          onSave={() => save.mutate()}
          valid={Boolean(title.trim() && picked.length) && !doc.isFetching}
          pending={save.isPending}
          label={editId ? 'Save changes' : 'Create submodule'}
        />
      }
    >
      <div className="space-y-5">
        <FormError message={(save.error || doc.error)?.message} />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Consistency models"
        />
        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={textarea}
          />
        </Field>
        <Field label={`Content · ${picked.length} selected`}>
          <OrderedPicker
            options={options}
            value={picked}
            onChange={setPicked}
            empty="Upload files or create questions first."
          />
        </Field>
      </div>
    </Modal>
  );
};

/* --------------------------------------------------------------- module */

type ModuleDoc = {
  title: string;
  description: string;
  submoduleIds: string[];
  durationDays: number;
  progressRequirement: number;
};

export const ModuleDialog: React.FC<DialogProps & { library?: Library }> = ({
  open,
  onClose,
  library,
  editId
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [threshold, setThreshold] = useState(70);

  const doc = useEditDoc<ModuleDoc>('module', open, editId, (d) => {
    setTitle(d?.title || '');
    setDescription(d?.description || '');
    setPicked((d?.submoduleIds || []).map(String));
    setDays(d?.durationDays || 7);
    setThreshold(d?.progressRequirement ?? 70);
  });

  const save = useSave(() => {
    const body = {
      title: title.trim(),
      description: description.trim(),
      submoduleIds: picked,
      durationDays: days,
      progressRequirement: threshold
    };
    return editId ? contentApi.update('module', editId, body) : contentApi.createModule(body);
  }, onClose);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={editId ? 'Edit module' : 'New module'}
      description="Group submodules and give learners a time window to finish them."
      maxWidth="2xl"
      footer={
        <Footer
          onClose={onClose}
          onSave={() => save.mutate()}
          valid={Boolean(title.trim() && days >= 1) && !doc.isFetching}
          pending={save.isPending}
          label={editId ? 'Save changes' : 'Create module'}
        />
      }
    >
      <div className="space-y-5">
        <FormError message={(save.error || doc.error)?.message} />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Week 1 — Foundations"
        />
        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={textarea}
          />
        </Field>
        <Field
          label="Deadline window"
          hint="A period, not a date. Each learner's clock starts when the module opens for them — late joiners get their own window."
        >
          <div className="flex flex-wrap items-center gap-2">
            {[3, 7, 14].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn(
                  'h-9 rounded-xl px-3 text-sm ring-1 ring-inset transition',
                  days === d
                    ? 'bg-ink text-white ring-ink'
                    : 'text-zinc-600 ring-zinc-200 hover:ring-zinc-300'
                )}
              >
                {d} days
              </button>
            ))}
            <Input
              type="number"
              min={1}
              value={days}
              onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
              containerClassName="w-24"
              aria-label="Days"
            />
          </div>
        </Field>
        <Field label={`Completion needed to stay on the cohort schedule · ${threshold}%`}>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-brand-600"
          />
        </Field>
        <Field label={`Submodules · ${picked.length} selected`}>
          <OrderedPicker
            options={(library?.submodules || []).map((s) => ({
              id: s._id,
              label: s.title,
              sublabel: `${s.itemCount} item${s.itemCount === 1 ? '' : 's'}`
            }))}
            value={picked}
            onChange={setPicked}
            empty="Create a submodule first."
          />
        </Field>
      </div>
    </Modal>
  );
};

/* -------------------------------------------------------- resource rename */

export const RenameResourceDialog: React.FC<DialogProps & { currentName: string }> = ({
  open,
  onClose,
  editId,
  currentName
}) => {
  const [name, setName] = useState(currentName);
  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);
  const save = useSave(
    () => contentApi.update('resource', editId!, { fileName: name.trim() }),
    onClose
  );

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Rename file"
      maxWidth="md"
      footer={
        <Footer
          onClose={onClose}
          onSave={() => save.mutate()}
          valid={Boolean(name.trim()) && name.trim() !== currentName}
          pending={save.isPending}
          label="Save"
        />
      }
    >
      <div className="space-y-4">
        <FormError message={save.error?.message} />
        <Input label="File name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
    </Modal>
  );
};
