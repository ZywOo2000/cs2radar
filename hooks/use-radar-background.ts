'use client';
import {useEffect,useState} from 'react';
import {defaultRadarBackground,loadRadarBackground,saveRadarBackground} from '@/lib/radar-background';
export function useRadarBackground(){
 const [background,setBackground]=useState(defaultRadarBackground),[loaded,setLoaded]=useState(false),[warning,setWarning]=useState('');
 useEffect(()=>{try{const result=loadRadarBackground(localStorage);setBackground(result.background);setWarning(result.warning)}catch{setWarning('无法恢复背景设置，已使用默认配色。')}setLoaded(true)},[]);
 useEffect(()=>{if(!loaded)return;try{const error=saveRadarBackground(localStorage,background);if(error)setWarning(error)}catch{setWarning('背景设置无法保存，当前页面仍可使用。')}},[background,loaded]);
 return {background,setBackground,warning};
}
