import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BlockComponent } from './block/block.component';
import { LibrarycardnumberComponent } from './librarycardnumber/librarycardnumber.component';
import { MainComponent } from './main/main.component';
import { SettingsComponent } from './settings/settings.component';
import { UsermenuComponent } from './usermenu/usermenu.component';

const routes: Routes = [
  { path: '', redirectTo: 'root/true', pathMatch: 'full' },
  { path: 'root/:isAutoSelect', component: MainComponent },
  { path: 'usermenu', component: UsermenuComponent },
  { path: 'block', component: BlockComponent },
  { path: 'settings', component: SettingsComponent },
  { path: 'librarycardnumber', component: LibrarycardnumberComponent },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
