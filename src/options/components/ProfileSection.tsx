import React, { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ProfileSchema, Profile } from '../../shared/schemas'
import { setProfile } from '../../shared/storage'
import { User, Save, Plus, Trash2 } from 'lucide-react'

export function ProfileSection({ initialData }: { initialData: Profile | null }) {
  const [isSaved, setIsSaved] = useState(false)
  const [skillInput, setSkillInput] = useState('')

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isDirty } } = useForm<Profile>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: initialData || {
      fullName: '', email: '', phone: '', location: '',
      links: { linkedin: '', github: '', website: '' },
      summary: '', skills: [], education: [], experience: [], projects: []
    }
  })

  const { fields: eduFields, append: appendEdu, remove: removeEdu } = useFieldArray({ control, name: 'education' })
  const { fields: expFields, append: appendExp, remove: removeExp } = useFieldArray({ control, name: 'experience' })
  const { fields: projFields, append: appendProj, remove: removeProj } = useFieldArray({ control, name: 'projects' })

  const summary = watch('summary')
  const skills = watch('skills') || []

  const onSubmit = async (data: Profile) => {
    await setProfile(data)
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const addSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const val = skillInput.trim().replace(/,$/, '')
      if (val && !skills.includes(val) && skills.length < 60) {
        setValue('skills', [...skills, val], { shouldDirty: true })
        setSkillInput('')
      }
    }
  }

  const removeSkill = (index: number) => {
    const newSkills = [...skills]
    newSkills.splice(index, 1)
    setValue('skills', newSkills, { shouldDirty: true })
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }}>
      <section className="section">
        <div className="flex-gap mb-4">
          <User className="text-muted" size={24} />
          <h2 style={{ margin: 0, border: 'none', padding: 0 }}>Candidate Profile</h2>
        </div>
        
        {/* Basics */}
        <h3 className="mt-4 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Basics</h3>
        <div className="grid-2">
          <div className="form-group">
            <label>Full Name</label>
            <input className="input" {...register('fullName')} />
            {errors.fullName && <span className="error-message">{errors.fullName.message}</span>}
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="input" {...register('email')} />
            {errors.email && <span className="error-message">{errors.email.message}</span>}
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="input" {...register('phone')} />
            {errors.phone && <span className="error-message">{errors.phone.message}</span>}
          </div>
          <div className="form-group">
            <label>Location</label>
            <input className="input" {...register('location')} />
            {errors.location && <span className="error-message">{errors.location.message}</span>}
          </div>
        </div>

        {/* Links */}
        <h3 className="mt-4 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>Links</h3>
        <div className="grid-2">
          <div className="form-group">
            <label>LinkedIn</label>
            <input type="url" className="input" placeholder="https://..." {...register('links.linkedin')} />
            {errors.links?.linkedin && <span className="error-message">{errors.links.linkedin.message}</span>}
          </div>
          <div className="form-group">
            <label>GitHub</label>
            <input type="url" className="input" placeholder="https://..." {...register('links.github')} />
            {errors.links?.github && <span className="error-message">{errors.links.github.message}</span>}
          </div>
          <div className="form-group">
            <label>Website</label>
            <input type="url" className="input" placeholder="https://..." {...register('links.website')} />
            {errors.links?.website && <span className="error-message">{errors.links.website.message}</span>}
          </div>
        </div>

        {/* Summary */}
        <div className="form-group mt-4">
          <div className="flex-between">
            <label>Professional Summary</label>
            <span className="text-sm text-muted">{summary?.length || 0} / 1000</span>
          </div>
          <textarea className="input" {...register('summary')} maxLength={1000} />
          {errors.summary && <span className="error-message">{errors.summary.message}</span>}
        </div>

        {/* Skills */}
        <div className="form-group mt-4">
          <label>Skills</label>
          <div className="input" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.5rem' }}>
            {skills.map((skill, i) => (
              <span key={i} style={{ background: 'var(--bg-button-hover)', color: 'var(--text-button)', padding: '0.125rem 0.5rem', borderRadius: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                {skill}
                <button type="button" onClick={() => removeSkill(i)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><XCircle size={14} /></button>
              </span>
            ))}
            <input 
              type="text" 
              value={skillInput} 
              onChange={e => setSkillInput(e.target.value)} 
              onKeyDown={addSkill}
              placeholder="Add skill (press Enter)"
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: '120px', color: 'inherit' }}
            />
          </div>
          {errors.skills && <span className="error-message">{errors.skills.message}</span>}
        </div>
      </section>

      {/* Experience */}
      <section className="section">
        <h2 style={{ border: 'none' }}>Experience</h2>
        {expFields.map((field, index) => (
          <div key={field.id} className="array-card">
            <button type="button" className="btn btn-secondary btn-icon array-card-remove" onClick={() => removeExp(index)}><Trash2 size={16} /></button>
            <div className="grid-2">
              <div className="form-group">
                <label>Organization</label>
                <input className="input" {...register(`experience.${index}.organization`)} />
                {errors.experience?.[index]?.organization && <span className="error-message">{errors.experience[index]?.organization?.message}</span>}
              </div>
              <div className="form-group">
                <label>Role</label>
                <input className="input" {...register(`experience.${index}.role`)} />
                {errors.experience?.[index]?.role && <span className="error-message">{errors.experience[index]?.role?.message}</span>}
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input className="input" placeholder="YYYY-MM" {...register(`experience.${index}.startDate`)} />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input className="input" placeholder="YYYY-MM (or blank if current)" {...register(`experience.${index}.endDate`)} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="input" style={{ minHeight: '60px' }} {...register(`experience.${index}.description`)} maxLength={600} />
              {errors.experience?.[index]?.description && <span className="error-message">{errors.experience[index]?.description?.message}</span>}
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => appendExp({ organization: '', role: '', description: '' })}>
          <Plus size={16} /> Add Experience
        </button>
      </section>

      {/* Education */}
      <section className="section">
        <h2 style={{ border: 'none' }}>Education</h2>
        {eduFields.map((field, index) => (
          <div key={field.id} className="array-card">
            <button type="button" className="btn btn-secondary btn-icon array-card-remove" onClick={() => removeEdu(index)}><Trash2 size={16} /></button>
            <div className="grid-2">
              <div className="form-group">
                <label>Institution</label>
                <input className="input" {...register(`education.${index}.institution`)} />
                {errors.education?.[index]?.institution && <span className="error-message">{errors.education[index]?.institution?.message}</span>}
              </div>
              <div className="form-group">
                <label>Degree</label>
                <input className="input" {...register(`education.${index}.degree`)} />
                {errors.education?.[index]?.degree && <span className="error-message">{errors.education[index]?.degree?.message}</span>}
              </div>
              <div className="form-group">
                <label>Field of Study</label>
                <input className="input" {...register(`education.${index}.field`)} />
              </div>
              <div className="form-group">
                <label>Start Year</label>
                <input type="number" className="input" {...register(`education.${index}.startYear`, { valueAsNumber: true })} />
              </div>
              <div className="form-group">
                <label>End Year</label>
                <input type="number" className="input" {...register(`education.${index}.endYear`, { valueAsNumber: true })} />
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => appendEdu({ institution: '', degree: '' })}>
          <Plus size={16} /> Add Education
        </button>
      </section>

      {/* Projects */}
      <section className="section">
        <h2 style={{ border: 'none' }}>Projects</h2>
        {projFields.map((field, index) => (
          <div key={field.id} className="array-card">
            <button type="button" className="btn btn-secondary btn-icon array-card-remove" onClick={() => removeProj(index)}><Trash2 size={16} /></button>
            <div className="grid-2">
              <div className="form-group">
                <label>Project Name</label>
                <input className="input" {...register(`projects.${index}.name`)} />
                {errors.projects?.[index]?.name && <span className="error-message">{errors.projects[index]?.name?.message}</span>}
              </div>
              <div className="form-group">
                <label>URL</label>
                <input type="url" className="input" {...register(`projects.${index}.url`)} />
                {errors.projects?.[index]?.url && <span className="error-message">{errors.projects[index]?.url?.message}</span>}
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="input" style={{ minHeight: '60px' }} {...register(`projects.${index}.description`)} maxLength={600} />
              {errors.projects?.[index]?.description && <span className="error-message">{errors.projects[index]?.description?.message}</span>}
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-secondary" onClick={() => appendProj({ name: '', description: '', technologies: [] })}>
          <Plus size={16} /> Add Project
        </button>
      </section>

      <div className="save-bar">
        <span className="text-muted text-sm">{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
        <button type="submit" className="btn" disabled={!isDirty && !isSaved}>
          <Save size={16} /> {isSaved ? 'Saved!' : 'Save Profile'}
        </button>
      </div>
    </form>
  )
}

function XCircle({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
    </svg>
  )
}
