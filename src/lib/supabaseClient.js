import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pxzaexutvuatdexgkavk.supabase.co'
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4emFleHV0dnVhdGRleGdrYXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyOTA4NjQsImV4cCI6MjA4NTg2Njg2NH0.t9n_8Up_Ybeq46tWWFpzn3TfuJMEe6krgdTSLh8xT9o'

export const supabase = createClient(supabaseUrl, supabaseKey);


export const userAPI = {
  async verifyCredentials(username, password) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, full_name, role, status, security_questions, security_answer, image_url')
        .eq('username', username)
        .eq('password', password)
        .eq('status', 'Active')
        .single();

      if (error || !data) return { data: null, error: 'Invalid credentials' };

      return {
        data: {
          ...data,
          security_question: data.security_questions
        },
        error: null
      };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async verifySecurityAnswer(username, securityAnswer) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, username, email, full_name, role, status, image_url')
        .eq('username', username)
        .ilike('security_answer', securityAnswer.trim())
        .single();

      if (error || !data) return { data: null, error: 'Incorrect answer' };

      return { data, error: null };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async createUser(userData) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{
          username: userData.username,
          email: userData.email,
          full_name: userData.fullName,
          phone: userData.phone,
          password: userData.password,
          role: userData.role,
          status: userData.status,
          security_questions: userData.securityQuestion,
          security_answer: userData.securityAnswer,
          image_url: userData.imageBase64 || null
        }])
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async updateUser(userId, userData) {
    try {
      const updateData = {
        email: userData.email,
        full_name: userData.fullName,
        phone: userData.phone,
        role: userData.role,
        status: userData.status,
        security_questions: userData.securityQuestion,
        security_answer: userData.securityAnswer
      };

      if (userData.password) {
        updateData.password = userData.password;
      }

      if (userData.imageBase64) {
        updateData.image_url = userData.imageBase64;
      }

      // Handle status-only updates (from deactivate button)
      if (typeof userData === 'string' || (userData.status && Object.keys(userData).length === 1)) {
        const { data, error } = await supabase
          .from('users')
          .update({ status: userData.status ?? userData })
          .eq('id', userId)
          .select()
          .single();
        return { data, error: error?.message };
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async deleteUser(userId) {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      return { error: error?.message };
    } catch (err) {
      return { error: err.message };
    }
  }
};


export const securityQuestionAPI = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('security_questions')
        .select('*')
        .order('created_at', { ascending: true });
      
      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async create(questionData) {
    try {
      const { data, error } = await supabase
        .from('security_questions')
        .insert([{ question: questionData.question }])
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async update(questionId, questionData) {
    try {
      const { data, error } = await supabase
        .from('security_questions')
        .update({ question: questionData.question })
        .eq('id', questionId)
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async delete(questionId) {
    try {
      const { error } = await supabase
        .from('security_questions')
        .delete()
        .eq('id', questionId);

      return { error: error?.message };
    } catch (err) {
      return { error: err.message };
    }
  }
};


export const userRoleAPI = {
  async getAll() {
    try {
      const { data, error } = await supabase
        .from('user_role')
        .select('*')
        .order('created_at', { ascending: false });
      
      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async create(roleData) {
    try {
      const { data, error } = await supabase
        .from('user_role')
        .insert([{
          role_name: roleData.roleName,
          status: roleData.status === "Active" || roleData.status === true 
        }])
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async update(roleId, roleData) {
    try {
      const { data, error } = await supabase
        .from('user_role')
        .update({
          role_name: roleData.roleName,
            status: roleData.status === "Active" || roleData.status === true
        })
        .eq('id', roleId)
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  async delete(roleId) {
    try {
      const { error } = await supabase
        .from('user_role')
        .delete()
        .eq('id', roleId);

      return { error: error?.message };
    } catch (err) {
      return { error: err.message };
    }
  }
};


export const rolePermissionAPI = {
  // Get all permissions for a specific role name
  async getPermissionsForUser(roleName) {
    try {
      const { data, error } = await supabase
        .from('role_permission')  // Check mo kung 'role_permission' or 'role_permissions' ang table name mo
        .select('*')
        .eq('role_name', roleName);
      
      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Create new permission
  async create(permissionData) {
    try {
      const { data, error } = await supabase
        .from('role_permission')
        .insert([{
          role_name: permissionData.role_name,
          module_path: permissionData.module_path,
          can_view: permissionData.can_view || false,
          can_create: permissionData.can_create || false,
          can_edit: permissionData.can_edit || false,
          can_delete: permissionData.can_delete || false
        }])
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  },

  // Update existing permission
  async update(permissionId, permissionData) {
    try {
      const { data, error } = await supabase
        .from('role_permission')
        .update({
        can_view: permissionData.can_view,
        can_create: permissionData.can_create,
        can_edit: permissionData.can_edit,
        can_delete: permissionData.can_delete
        })
        .eq('id', permissionId)
        .select()
        .single();

      return { data, error: error?.message };
    } catch (err) {
      return { data: null, error: err.message };
    }
  }
};


export default supabase;