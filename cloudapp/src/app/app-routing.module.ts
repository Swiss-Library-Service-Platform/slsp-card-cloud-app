import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { BlockComponent } from './block/block.component';
import { MainComponent } from './main/main.component';

const routes: Routes = [
  { path: '', component: MainComponent },
  { path: 'block', component: BlockComponent },

];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
