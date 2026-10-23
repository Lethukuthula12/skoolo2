export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_reports: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          document_path: string | null
          end_date: string
          id: string
          learner_id: string
          note: string | null
          reason: string
          reported_by: string | null
          school_id: string
          start_date: string
          status: Database["public"]["Enums"]["absence_status"]
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          document_path?: string | null
          end_date: string
          id?: string
          learner_id: string
          note?: string | null
          reason?: string
          reported_by?: string | null
          school_id: string
          start_date: string
          status?: Database["public"]["Enums"]["absence_status"]
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          document_path?: string | null
          end_date?: string
          id?: string
          learner_id?: string
          note?: string | null
          reason?: string
          reported_by?: string | null
          school_id?: string
          start_date?: string
          status?: Database["public"]["Enums"]["absence_status"]
        }
        Relationships: [
          {
            foreignKeyName: "absence_reports_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_terms: {
        Row: {
          academic_year: number
          closes_at: string | null
          created_at: string
          id: string
          next_term_opens_at: string | null
          opens_at: string | null
          school_id: string
          term_number: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          closes_at?: string | null
          created_at?: string
          id?: string
          next_term_opens_at?: string | null
          opens_at?: string | null
          school_id: string
          term_number: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          closes_at?: string | null
          created_at?: string
          id?: string
          next_term_opens_at?: string | null
          opens_at?: string | null
          school_id?: string
          term_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_terms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          id: string
          mime_type: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          application_id: string
          created_at?: string
          document_type: Database["public"]["Enums"]["document_type"]
          file_name: string
          id?: string
          mime_type: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["document_type"]
          file_name?: string
          id?: string
          mime_type?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_history: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: number
          note: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: never
          note?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: never
          note?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          address_line: string
          created_at: string
          guardian_full_name: string
          guardian_identity_number: string | null
          guardian_phone: string
          guardian_relationship: string
          id: string
          learner_id: string
          marked_paid_at: string | null
          parent_id: string
          parent_note: string | null
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          payment_reference: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          period_grade_id: string
          period_id: string
          postal_code: string
          province: Database["public"]["Enums"]["sa_province"]
          school_id: string
          staff_note: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          suburb: string
          town: string
          transport_provider_name: string | null
          updated_at: string
          uses_school_transport: boolean | null
        }
        Insert: {
          address_line: string
          created_at?: string
          guardian_full_name?: string
          guardian_identity_number?: string | null
          guardian_phone?: string
          guardian_relationship?: string
          id?: string
          learner_id: string
          marked_paid_at?: string | null
          parent_id: string
          parent_note?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          period_grade_id: string
          period_id: string
          postal_code?: string
          province: Database["public"]["Enums"]["sa_province"]
          school_id: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          suburb?: string
          town: string
          transport_provider_name?: string | null
          updated_at?: string
          uses_school_transport?: boolean | null
        }
        Update: {
          address_line?: string
          created_at?: string
          guardian_full_name?: string
          guardian_identity_number?: string | null
          guardian_phone?: string
          guardian_relationship?: string
          id?: string
          learner_id?: string
          marked_paid_at?: string | null
          parent_id?: string
          parent_note?: string | null
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          payment_reference?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          period_grade_id?: string
          period_id?: string
          postal_code?: string
          province?: Database["public"]["Enums"]["sa_province"]
          school_id?: string
          staff_note?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          suburb?: string
          town?: string
          transport_provider_name?: string | null
          updated_at?: string
          uses_school_transport?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_payment_confirmed_by_fkey"
            columns: ["payment_confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_period_grade_id_fkey"
            columns: ["period_grade_id"]
            isOneToOne: false
            referencedRelation: "period_grade_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_period_grade_id_fkey"
            columns: ["period_grade_id"]
            isOneToOne: false
            referencedRelation: "period_grades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enrolment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["open_period_id"]
          },
          {
            foreignKeyName: "applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_scores: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          is_absent: boolean
          learner_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          is_absent?: boolean
          learner_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          is_absent?: boolean
          learner_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_scores_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_scores_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          assessed_on: string | null
          class_id: string
          created_at: string
          id: string
          kind: string
          max_score: number
          school_id: string
          subject_id: string
          term_number: number
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          assessed_on?: string | null
          class_id: string
          created_at?: string
          id?: string
          kind?: string
          max_score?: number
          school_id: string
          subject_id: string
          term_number: number
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          assessed_on?: string | null
          class_id?: string
          created_at?: string
          id?: string
          kind?: string
          max_score?: number
          school_id?: string
          subject_id?: string
          term_number?: number
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          class_id: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          ends_at: string | null
          event_date: string
          id: string
          kind: string
          notes: string | null
          parent_visible: boolean
          school_id: string
          staff_member_id: string | null
          starts_at: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          ends_at?: string | null
          event_date: string
          id?: string
          kind?: string
          notes?: string | null
          parent_visible?: boolean
          school_id: string
          staff_member_id?: string | null
          starts_at?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          ends_at?: string | null
          event_date?: string
          id?: string
          kind?: string
          notes?: string | null
          parent_visible?: boolean
          school_id?: string
          staff_member_id?: string | null
          starts_at?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject_id: string
          teacher_id: string | null
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
          teacher_id?: string | null
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
          teacher_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          academic_year: number
          class_teacher_id: string | null
          created_at: string
          grade_code: string
          id: string
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          academic_year: number
          class_teacher_id?: string | null
          created_at?: string
          grade_code: string
          id?: string
          name: string
          school_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          class_teacher_id?: string | null
          created_at?: string
          grade_code?: string
          id?: string
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      enrolment_periods: {
        Row: {
          academic_year: number
          closes_at: string | null
          created_at: string
          currency: string
          fee_amount: number
          id: string
          instructions: string | null
          name: string
          opens_at: string | null
          school_id: string
          status: Database["public"]["Enums"]["period_status"]
          updated_at: string
        }
        Insert: {
          academic_year: number
          closes_at?: string | null
          created_at?: string
          currency?: string
          fee_amount?: number
          id?: string
          instructions?: string | null
          name: string
          opens_at?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Update: {
          academic_year?: number
          closes_at?: string | null
          created_at?: string
          currency?: string
          fee_amount?: number
          id?: string
          instructions?: string | null
          name?: string
          opens_at?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["period_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrolment_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrolment_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_payments: {
        Row: {
          account_id: string
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          learner_id: string
          method: string
          note: string | null
          paid_on: string
          recorded_by: string | null
          reference: string | null
          school_id: string
          status: Database["public"]["Enums"]["fee_payment_status"]
        }
        Insert: {
          account_id: string
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          learner_id: string
          method?: string
          note?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["fee_payment_status"]
        }
        Update: {
          account_id?: string
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          learner_id?: string
          method?: string
          note?: string | null
          paid_on?: string
          recorded_by?: string | null
          reference?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["fee_payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "fee_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fee_account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "fee_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "learner_fee_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year: number
          annual_amount: number
          created_at: string
          grade_code: string
          id: string
          months_per_year: number
          school_id: string
          terms_per_year: number
          updated_at: string
          upfront_discount_percent: number
        }
        Insert: {
          academic_year: number
          annual_amount: number
          created_at?: string
          grade_code: string
          id?: string
          months_per_year?: number
          school_id: string
          terms_per_year?: number
          updated_at?: string
          upfront_discount_percent?: number
        }
        Update: {
          academic_year?: number
          annual_amount?: number
          created_at?: string
          grade_code?: string
          id?: string
          months_per_year?: number
          school_id?: string
          terms_per_year?: number
          updated_at?: string
          upfront_discount_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      grades: {
        Row: {
          code: string
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          label: string
          sort_order: number
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      learner_fee_accounts: {
        Row: {
          academic_year: number
          created_at: string
          id: string
          learner_id: string
          payment_reference: string
          plan: Database["public"]["Enums"]["fee_plan"]
          school_id: string
          total_due: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          created_at?: string
          id?: string
          learner_id: string
          payment_reference: string
          plan?: Database["public"]["Enums"]["fee_plan"]
          school_id: string
          total_due?: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          created_at?: string
          id?: string
          learner_id?: string
          payment_reference?: string
          plan?: Database["public"]["Enums"]["fee_plan"]
          school_id?: string
          total_due?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "learner_fee_accounts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_fee_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_fee_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      learner_guardians: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_primary: boolean
          learner_id: string
          phone: string
          relationship: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_primary?: boolean
          learner_id: string
          phone?: string
          relationship?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_primary?: boolean
          learner_id?: string
          phone?: string
          relationship?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learner_guardians_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_guardians_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          admission_number: string | null
          created_at: string
          current_class_id: string | null
          date_of_birth: string
          family_code: string | null
          first_name: string
          gender: Database["public"]["Enums"]["gender"]
          home_language: string | null
          id: string
          identity_number: string | null
          last_name: string
          nationality: string
          parent_id: string | null
          passport_number: string | null
          previous_school: string | null
          school_id: string | null
          updated_at: string
          years_in_phase: number | null
        }
        Insert: {
          admission_number?: string | null
          created_at?: string
          current_class_id?: string | null
          date_of_birth: string
          family_code?: string | null
          first_name: string
          gender?: Database["public"]["Enums"]["gender"]
          home_language?: string | null
          id?: string
          identity_number?: string | null
          last_name: string
          nationality?: string
          parent_id?: string | null
          passport_number?: string | null
          previous_school?: string | null
          school_id?: string | null
          updated_at?: string
          years_in_phase?: number | null
        }
        Update: {
          admission_number?: string | null
          created_at?: string
          current_class_id?: string | null
          date_of_birth?: string
          family_code?: string | null
          first_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          home_language?: string | null
          id?: string
          identity_number?: string | null
          last_name?: string
          nationality?: string
          parent_id?: string | null
          passport_number?: string | null
          previous_school?: string | null
          school_id?: string | null
          updated_at?: string
          years_in_phase?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "learners_current_class_id_fkey"
            columns: ["current_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      message_threads: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          last_message_at: string
          learner_id: string
          school_id: string
          subject: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          learner_id: string
          school_id: string
          subject?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          last_message_at?: string
          learner_id?: string
          school_id?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_threads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          application_id: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          school_id: string | null
          subject: string
        }
        Insert: {
          application_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          school_id?: string | null
          subject: string
        }
        Update: {
          application_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          school_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      period_grades: {
        Row: {
          capacity: number | null
          created_at: string
          grade_code: string
          id: string
          is_open: boolean
          period_id: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          grade_code: string
          id?: string
          is_open?: boolean
          period_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          grade_code?: string
          id?: string
          is_open?: boolean
          period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "period_grades_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "period_grades_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enrolment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_grades_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["open_period_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      report_cards: {
        Row: {
          academic_year: number
          approved_at: string | null
          approved_by: string | null
          class_id: string
          created_at: string
          days_absent: number | null
          id: string
          learner_id: string
          principal_comment: string | null
          published_at: string | null
          school_id: string
          status: Database["public"]["Enums"]["report_status"]
          teacher_comment: string | null
          term_number: number
          updated_at: string
        }
        Insert: {
          academic_year: number
          approved_at?: string | null
          approved_by?: string | null
          class_id: string
          created_at?: string
          days_absent?: number | null
          id?: string
          learner_id: string
          principal_comment?: string | null
          published_at?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["report_status"]
          teacher_comment?: string | null
          term_number: number
          updated_at?: string
        }
        Update: {
          academic_year?: number
          approved_at?: string | null
          approved_by?: string | null
          class_id?: string
          created_at?: string
          days_absent?: number | null
          id?: string
          learner_id?: string
          principal_comment?: string | null
          published_at?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          teacher_comment?: string | null
          term_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      report_marks: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          mark: number | null
          report_card_id: string
          subject_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          mark?: number | null
          report_card_id: string
          subject_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          mark?: number | null
          report_card_id?: string
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_marks_report_card_id_fkey"
            columns: ["report_card_id"]
            isOneToOne: false
            referencedRelation: "report_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_marks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      school_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          branch_code: string
          school_id: string
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type?: string
          bank_name: string
          branch_code: string
          school_id: string
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          branch_code?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_bank_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_periods: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_break: boolean
          name: string
          position: number
          school_id: string
          starts_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_break?: boolean
          name: string
          position: number
          school_id: string
          starts_at: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_break?: boolean
          name?: string
          position?: number
          school_id?: string
          starts_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_staff: {
        Row: {
          created_at: string
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          badge_url: string | null
          company_registration: string | null
          created_at: string
          description: string | null
          email: string | null
          highest_grade: string | null
          id: string
          is_claimed: boolean
          is_verified: boolean
          legal_name: string | null
          lowest_grade: string | null
          name: string
          npo_registration: string | null
          phone: string | null
          province: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone: string | null
          slug: string
          stamp_url: string | null
          street_address: string | null
          subject_teaching_from_grade: string | null
          tagline: string | null
          tax_reference: string | null
          theme: Json | null
          town: string
          updated_at: string
          website: string | null
        }
        Insert: {
          badge_url?: string | null
          company_registration?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          highest_grade?: string | null
          id?: string
          is_claimed?: boolean
          is_verified?: boolean
          legal_name?: string | null
          lowest_grade?: string | null
          name: string
          npo_registration?: string | null
          phone?: string | null
          province?: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone?: string | null
          slug: string
          stamp_url?: string | null
          street_address?: string | null
          subject_teaching_from_grade?: string | null
          tagline?: string | null
          tax_reference?: string | null
          theme?: Json | null
          town?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          badge_url?: string | null
          company_registration?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          highest_grade?: string | null
          id?: string
          is_claimed?: boolean
          is_verified?: boolean
          legal_name?: string | null
          lowest_grade?: string | null
          name?: string
          npo_registration?: string | null
          phone?: string | null
          province?: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone?: string | null
          slug?: string
          stamp_url?: string | null
          street_address?: string | null
          subject_teaching_from_grade?: string | null
          tagline?: string | null
          tax_reference?: string | null
          theme?: Json | null
          town?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_highest_grade_fkey"
            columns: ["highest_grade"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "schools_lowest_grade_fkey"
            columns: ["lowest_grade"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "schools_subject_teaching_from_grade_fkey"
            columns: ["subject_teaching_from_grade"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string
          document_type: string
          file_name: string
          id: string
          mime_type: string
          school_id: string
          size_bytes: number | null
          staff_member_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string
          file_name: string
          id?: string
          mime_type: string
          school_id: string
          size_bytes?: number | null
          staff_member_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string
          file_name?: string
          id?: string
          mime_type?: string
          school_id?: string
          size_bytes?: number | null
          staff_member_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          code: string
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          role: string
          school_id: string
          staff_member_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          email: string
          expires_at?: string
          full_name?: string
          id?: string
          role?: string
          school_id: string
          staff_member_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          role?: string
          school_id?: string
          staff_member_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_invites_accepted_by_fkey"
            columns: ["accepted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_invites_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          address: string | null
          class_assigned: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          identity_number: string | null
          is_active: boolean
          last_name: string
          notes: string | null
          phone: string | null
          position: string
          school_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          class_assigned?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          identity_number?: string | null
          is_active?: boolean
          last_name: string
          notes?: string | null
          phone?: string | null
          position?: string
          school_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          class_assigned?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          identity_number?: string | null
          is_active?: boolean
          last_name?: string
          notes?: string | null
          phone?: string | null
          position?: string
          school_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          grade_code: string
          id: string
          language_level: string | null
          name: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_code: string
          id?: string
          language_level?: string | null
          name: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_code?: string
          id?: string
          language_level?: string | null
          name?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          thread_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          thread_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_lessons: {
        Row: {
          academic_year: number
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          period_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          academic_year: number
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          period_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          academic_year?: number
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          period_id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_lessons_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "school_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_lessons_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fee_account_balances: {
        Row: {
          academic_year: number | null
          account_id: string | null
          balance: number | null
          learner_id: string | null
          payment_reference: string | null
          plan: Database["public"]["Enums"]["fee_plan"] | null
          school_id: string | null
          total_due: number | null
          total_paid: number | null
        }
        Insert: {
          academic_year?: number | null
          account_id?: string | null
          balance?: never
          learner_id?: string | null
          payment_reference?: string | null
          plan?: Database["public"]["Enums"]["fee_plan"] | null
          school_id?: string | null
          total_due?: number | null
          total_paid?: never
        }
        Update: {
          academic_year?: number | null
          account_id?: string | null
          balance?: never
          learner_id?: string | null
          payment_reference?: string | null
          plan?: Database["public"]["Enums"]["fee_plan"] | null
          school_id?: string | null
          total_due?: number | null
          total_paid?: never
        }
        Relationships: [
          {
            foreignKeyName: "learner_fee_accounts_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_fee_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learner_fee_accounts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      period_grade_availability: {
        Row: {
          capacity: number | null
          grade_code: string | null
          grade_label: string | null
          id: string | null
          is_available: boolean | null
          is_open: boolean | null
          period_id: string | null
          places_left: number | null
          places_taken: number | null
          sort_order: number | null
        }
        Relationships: [
          {
            foreignKeyName: "period_grades_grade_code_fkey"
            columns: ["grade_code"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "period_grades_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "enrolment_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "period_grades_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["open_period_id"]
          },
        ]
      }
      school_directory: {
        Row: {
          badge_url: string | null
          closes_at: string | null
          currency: string | null
          description: string | null
          email: string | null
          fee_amount: number | null
          highest_grade: string | null
          id: string | null
          is_claimed: boolean | null
          is_open_for_registration: boolean | null
          is_verified: boolean | null
          lowest_grade: string | null
          name: string | null
          open_academic_year: number | null
          open_period_id: string | null
          opens_at: string | null
          phone: string | null
          province: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone: string | null
          slug: string | null
          street_address: string | null
          tagline: string | null
          town: string | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_highest_grade_fkey"
            columns: ["highest_grade"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "schools_lowest_grade_fkey"
            columns: ["lowest_grade"]
            isOneToOne: false
            referencedRelation: "grades"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Functions: {
      accept_staff_invite: {
        Args: { p_code: string }
        Returns: {
          badge_url: string | null
          company_registration: string | null
          created_at: string
          description: string | null
          email: string | null
          highest_grade: string | null
          id: string
          is_claimed: boolean
          is_verified: boolean
          legal_name: string | null
          lowest_grade: string | null
          name: string
          npo_registration: string | null
          phone: string | null
          province: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone: string | null
          slug: string
          stamp_url: string | null
          street_address: string | null
          subject_teaching_from_grade: string | null
          tagline: string | null
          tax_reference: string | null
          theme: Json | null
          town: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "schools"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      achievement_description: { Args: { p_level: number }; Returns: string }
      achievement_level: { Args: { p_mark: number }; Returns: number }
      acknowledge_absence: {
        Args: { p_absence_id: string }
        Returns: undefined
      }
      application_message: {
        Args: {
          p_application: Database["public"]["Tables"]["applications"]["Row"]
          p_body: string
          p_subject: string
        }
        Returns: undefined
      }
      approve_class_reports: {
        Args: { p_class_id: string; p_term: number }
        Returns: number
      }
      assessment_class_id: {
        Args: { p_assessment_id: string }
        Returns: string
      }
      can_access_learner: { Args: { p_learner_id: string }; Returns: boolean }
      can_edit_class_reports: { Args: { p_class_id: string }; Returns: boolean }
      can_read_report: { Args: { p_report_card_id: string }; Returns: boolean }
      claim_school: {
        Args: { p_school_id: string }
        Returns: {
          badge_url: string | null
          company_registration: string | null
          created_at: string
          description: string | null
          email: string | null
          highest_grade: string | null
          id: string
          is_claimed: boolean
          is_verified: boolean
          legal_name: string | null
          lowest_grade: string | null
          name: string
          npo_registration: string | null
          phone: string | null
          province: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone: string | null
          slug: string
          stamp_url: string | null
          street_address: string | null
          subject_teaching_from_grade: string | null
          tagline: string | null
          tax_reference: string | null
          theme: Json | null
          town: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "schools"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      class_school_id: { Args: { p_class_id: string }; Returns: string }
      computed_subject_term_mark: {
        Args: {
          p_class_id: string
          p_learner_id: string
          p_subject_id: string
          p_term: number
        }
        Returns: number
      }
      confirm_application_payment: {
        Args: { p_application_id: string; p_note?: string }
        Returns: undefined
      }
      confirm_fee_payment: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      create_school: {
        Args: {
          p_email?: string
          p_highest_grade?: string
          p_lowest_grade?: string
          p_name: string
          p_phone?: string
          p_province: Database["public"]["Enums"]["sa_province"]
          p_town: string
        }
        Returns: {
          badge_url: string | null
          company_registration: string | null
          created_at: string
          description: string | null
          email: string | null
          highest_grade: string | null
          id: string
          is_claimed: boolean
          is_verified: boolean
          legal_name: string | null
          lowest_grade: string | null
          name: string
          npo_registration: string | null
          phone: string | null
          province: Database["public"]["Enums"]["sa_province"] | null
          secondary_phone: string | null
          slug: string
          stamp_url: string | null
          street_address: string | null
          subject_teaching_from_grade: string | null
          tagline: string | null
          tax_reference: string | null
          theme: Json | null
          town: string
          updated_at: string
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "schools"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_assessment: { Args: { p_id: string }; Returns: undefined }
      enrol_application: {
        Args: { p_application_id: string; p_class_id: string }
        Returns: undefined
      }
      ensure_fee_account: {
        Args: {
          p_learner_id: string
          p_plan: Database["public"]["Enums"]["fee_plan"]
          p_year: number
        }
        Returns: string
      }
      ensure_fee_accounts_for_class: {
        Args: {
          p_class_id: string
          p_plan: Database["public"]["Enums"]["fee_plan"]
          p_year: number
        }
        Returns: number
      }
      ensure_term_reports: {
        Args: { p_class_id: string; p_term: number }
        Returns: number
      }
      fee_payment_instructions: {
        Args: { p_account_id: string }
        Returns: {
          account_holder: string
          account_number: string
          account_type: string
          balance: number
          bank_name: string
          branch_code: string
          monthly: number
          payment_reference: string
          plan: Database["public"]["Enums"]["fee_plan"]
          school_name: string
          term: number
          total_due: number
          total_paid: number
        }[]
      }
      generate_family_code: { Args: never; Returns: string }
      generate_fee_reference: { Args: never; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      generate_payment_reference: { Args: never; Returns: string }
      get_payment_instructions: {
        Args: { p_application_id: string }
        Returns: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          branch_code: string
          currency: string
          fee_amount: number
          instructions: string
          payment_reference: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          school_name: string
        }[]
      }
      is_allowed_status_transition: {
        Args: {
          p_from: Database["public"]["Enums"]["application_status"]
          p_to: Database["public"]["Enums"]["application_status"]
        }
        Returns: boolean
      }
      is_connected_parent: { Args: { p_learner_id: string }; Returns: boolean }
      is_learner_staff: { Args: { p_learner_id: string }; Returns: boolean }
      is_my_staff_member: {
        Args: { p_staff_member_id: string }
        Returns: boolean
      }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      is_school_staff: { Args: { p_school_id: string }; Returns: boolean }
      is_valid_sa_identity_number: {
        Args: { p_value: string }
        Returns: boolean
      }
      learner_parent_id: { Args: { p_learner_id: string }; Returns: string }
      learner_school_id: { Args: { p_learner_id: string }; Returns: string }
      mark_application_paid: {
        Args: { p_application_id: string }
        Returns: undefined
      }
      message_class: {
        Args: { p_body: string; p_class_id: string; p_subject: string }
        Returns: number
      }
      my_children: {
        Args: never
        Returns: {
          class_name: string
          date_of_birth: string
          first_name: string
          grade_label: string
          id: string
          last_name: string
          school_name: string
        }[]
      }
      my_classes: {
        Args: never
        Returns: {
          academic_year: number
          grade_code: string
          id: string
          is_class_teacher: boolean
          name: string
          school_id: string
        }[]
      }
      my_staff_member: { Args: { p_school_id: string }; Returns: string }
      my_timetable: {
        Args: { p_year: number }
        Returns: {
          class_id: string
          class_name: string
          day_of_week: number
          ends_at: string
          grade_code: string
          id: string
          period_id: string
          period_name: string
          period_position: number
          starts_at: string
          subject_id: string
          subject_name: string
        }[]
      }
      notify_learner_staff: {
        Args: { p_body: string; p_learner_id: string; p_subject: string }
        Returns: undefined
      }
      notify_thread_counterparts: {
        Args: { p_body: string; p_thread_id: string }
        Returns: undefined
      }
      parent_at_school: { Args: { p_school_id: string }; Returns: boolean }
      period_grade_taken: {
        Args: { p_period_grade_id: string }
        Returns: number
      }
      period_school_id: { Args: { p_period_id: string }; Returns: string }
      place_lesson: {
        Args: {
          p_class_id: string
          p_day_of_week: number
          p_period_id: string
          p_subject_id: string
        }
        Returns: string
      }
      post_message: {
        Args: { p_body: string; p_thread_id: string }
        Returns: undefined
      }
      publish_class_reports: {
        Args: { p_class_id: string; p_term: number }
        Returns: number
      }
      recalculate_subject_term: {
        Args: { p_class_id: string; p_subject_id: string; p_term: number }
        Returns: undefined
      }
      recompute_report_mark: {
        Args: {
          p_class_id: string
          p_learner_id: string
          p_subject_id: string
          p_term: number
        }
        Returns: undefined
      }
      record_fee_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_method: string
          p_note?: string
          p_paid_on?: string
          p_reference?: string
        }
        Returns: string
      }
      redeem_family_code: {
        Args: { p_code: string; p_relationship?: string }
        Returns: {
          first_name: string
          last_name: string
          learner_id: string
          school_name: string
        }[]
      }
      regenerate_family_code: {
        Args: { p_learner_id: string }
        Returns: string
      }
      remove_lesson: { Args: { p_lesson_id: string }; Returns: undefined }
      report_absence: {
        Args: {
          p_document_path?: string
          p_end: string
          p_learner_id: string
          p_note?: string
          p_reason: string
          p_start: string
        }
        Returns: string
      }
      save_assessment: {
        Args: {
          p_assessed_on: string
          p_class_id: string
          p_id: string
          p_kind: string
          p_max_score: number
          p_subject_id: string
          p_term: number
          p_title: string
          p_weight: number
        }
        Returns: string
      }
      save_assessment_score: {
        Args: {
          p_assessment_id: string
          p_is_absent: boolean
          p_learner_id: string
          p_score: number
        }
        Returns: undefined
      }
      save_mark: {
        Args: { p_mark: number; p_report_card_id: string; p_subject_id: string }
        Returns: undefined
      }
      school_application_counts: {
        Args: { p_school_id: string }
        Returns: {
          payment_status: Database["public"]["Enums"]["payment_status"]
          status: Database["public"]["Enums"]["application_status"]
          total: number
        }[]
      }
      seed_default_subjects: { Args: { p_school_id: string }; Returns: number }
      set_application_status: {
        Args: {
          p_application_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["application_status"]
        }
        Returns: undefined
      }
      set_class_family_codes: { Args: { p_class_id: string }; Returns: number }
      set_fee_structure: {
        Args: {
          p_annual: number
          p_discount?: number
          p_grade: string
          p_months?: number
          p_school_id: string
          p_terms?: number
          p_year: number
        }
        Returns: undefined
      }
      set_report_meta: {
        Args: {
          p_days_absent: number
          p_report_card_id: string
          p_teacher_comment: string
        }
        Returns: undefined
      }
      staff_school_ids: { Args: never; Returns: string[] }
      start_thread: {
        Args: { p_body: string; p_learner_id: string; p_subject: string }
        Returns: string
      }
      teaches_class: { Args: { p_class_id: string }; Returns: boolean }
      thread_learner: { Args: { p_thread_id: string }; Returns: string }
      withdraw_application: {
        Args: { p_application_id: string }
        Returns: undefined
      }
    }
    Enums: {
      absence_status: "reported" | "acknowledged"
      application_status:
        | "submitted"
        | "under_review"
        | "more_info_needed"
        | "accepted"
        | "waitlisted"
        | "declined"
        | "withdrawn"
      document_type:
        | "birth_certificate"
        | "parent_identity"
        | "proof_of_address"
        | "latest_report"
        | "immunisation_card"
        | "other"
      fee_payment_status: "recorded" | "confirmed"
      fee_plan: "monthly" | "term" | "year"
      gender: "female" | "male" | "unspecified"
      payment_status: "unpaid" | "marked_paid" | "confirmed"
      period_status: "draft" | "open" | "closed"
      report_status: "draft" | "approved" | "published"
      sa_province:
        | "Eastern Cape"
        | "Free State"
        | "Gauteng"
        | "KwaZulu-Natal"
        | "Limpopo"
        | "Mpumalanga"
        | "North West"
        | "Northern Cape"
        | "Western Cape"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      absence_status: ["reported", "acknowledged"],
      application_status: [
        "submitted",
        "under_review",
        "more_info_needed",
        "accepted",
        "waitlisted",
        "declined",
        "withdrawn",
      ],
      document_type: [
        "birth_certificate",
        "parent_identity",
        "proof_of_address",
        "latest_report",
        "immunisation_card",
        "other",
      ],
      fee_payment_status: ["recorded", "confirmed"],
      fee_plan: ["monthly", "term", "year"],
      gender: ["female", "male", "unspecified"],
      payment_status: ["unpaid", "marked_paid", "confirmed"],
      period_status: ["draft", "open", "closed"],
      report_status: ["draft", "approved", "published"],
      sa_province: [
        "Eastern Cape",
        "Free State",
        "Gauteng",
        "KwaZulu-Natal",
        "Limpopo",
        "Mpumalanga",
        "North West",
        "Northern Cape",
        "Western Cape",
      ],
    },
  },
} as const
