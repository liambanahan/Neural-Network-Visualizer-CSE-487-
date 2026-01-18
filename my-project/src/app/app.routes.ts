import { Routes } from '@angular/router';
import { StyleTransferPageComponent } from './pages/style-transfer-page.component';
import { GalleryPageComponent } from './pages/gallery-page.component';
import { AdminPageComponent } from './pages/admin-page.component';
import { adminGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: StyleTransferPageComponent },
  { path: 'gallery', component: GalleryPageComponent },
  { path: 'admin', component: AdminPageComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
