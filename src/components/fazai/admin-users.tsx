'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { t } from '@/lib/i18n';
import { db, type User } from '@/lib/fazai-db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { v4 as uuid } from 'uuid';
import { useToast } from '@/hooks/use-toast';

export function AdminUsers() {
  const { lang } = useAuthStore();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');

  const loadRef = useRef(false);

  const loadUsers = useCallback(async () => {
    const list = await db.users.toArray();
    setUsers(list);
  }, []);

  useEffect(() => {
    if (!loadRef.current) {
      loadRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadUsers();
    }
  }, [loadUsers]);

  const handleSave = async () => {
    if (!name.trim() || pin.length !== 6) return;

    if (editUser) {
      await db.users.update(editUser.id, { name: name.trim(), pin, role });
    } else {
      await db.users.add({ id: `user-${uuid()}`, pin, name: name.trim(), role, createdAt: new Date() });
    }

    setEditUser(null);
    setShowAdd(false);
    setName('');
    setPin('');
    setRole('user');
    toast({ title: t('common.success', lang) });
    loadUsers();
  };

  const handleDelete = async (id: string) => {
    await db.users.delete(id);
    setDeleteId(null);
    toast({ title: t('common.success', lang) });
    loadUsers();
  };

  const startEdit = (user: User) => {
    setEditUser(user);
    setName(user.name);
    setPin(user.pin);
    setRole(user.role);
  };

  const startAdd = () => {
    setShowAdd(true);
    setName('');
    setPin('');
    setRole('user');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('admin.users', lang)}</h3>
        <Button size="sm" onClick={startAdd}>
          <Plus className="w-4 h-4 mr-1" /> {t('admin.addUser', lang)}
        </Button>
      </div>

      {users.map((user) => (
        <Card key={user.id} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.role === 'admin' ? t('admin.adminRole', lang) : t('admin.userRole', lang)} · PIN: ****
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => startEdit(user)}>
                <Pencil className="w-4 h-4" />
              </Button>
              {!user.isSystem && user.id !== 'admin-1' && (
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(user.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        </Card>
      ))}

      {/* Add/Edit Dialog */}
      <Dialog open={!!editUser || showAdd} onOpenChange={() => { setEditUser(null); setShowAdd(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editUser ? t('admin.editUser', lang) : t('admin.addUser', lang)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-sm font-medium">{t('admin.name', lang)}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.pin', lang)}</label>
              <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} className="mt-1" placeholder="000000" />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.role', lang)}</label>
              <Select value={role} onValueChange={(v) => setRole(v as 'admin' | 'user')}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('admin.adminRole', lang)}</SelectItem>
                  <SelectItem value="user">{t('admin.userRole', lang)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditUser(null); setShowAdd(false); }}>{t('common.cancel', lang)}</Button>
            <Button onClick={handleSave} disabled={!name.trim() || pin.length !== 6}>{t('common.save', lang)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete', lang)}</AlertDialogTitle>
            <AlertDialogDescription>{t('common.cannotUndo', lang)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', lang)}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDelete(deleteId)}>{t('common.delete', lang)}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
